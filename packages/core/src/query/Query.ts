//@ts-nocheck
import { action, observable, makeObservable, computed } from 'mobx';
import { normalizeResponseGenerator } from '../cache';
import { Connection } from '../connection';
import QueryData from './QueryData';
import { types } from 'mobx-state-tree';
import { FetchPolicy, QueryOptions } from './types';

export type CaseHandlers<T, R> = {
  loading(): R;
  error(error: any): R;
  data(data: T): R;
};

export const GETTER_QUERIES = ['findOne', 'findMany', 'count'];
export const SETTER_QUERIES = [
  'update',
  'updateMany',
  'create',
  'delete',
  'deleteMany',
];

const getFetchPolicy = (
  query: QueryData,
  config?: QueryOptions
): FetchPolicy => {
  let fetchPolicy;

  // default policies
  if (GETTER_QUERIES.includes(query.operation)) {
    fetchPolicy = 'cache-and-network';
  } else if (SETTER_QUERIES.includes(query.operation)) {
    fetchPolicy = 'no-cache';
  }

  // override default policies
  fetchPolicy = config?.fetchPolicy ? config?.fetchPolicy : fetchPolicy;

  if (!fetchPolicy) {
    fetchPolicy = 'network-only';
    console.error(
      `No cache policy found for a query with key ${query.queryKey}, using network-only by default `
    );
  }

  return fetchPolicy;
};

// const isServer: boolean = typeof window === 'undefined';

export class Query<T = unknown> implements PromiseLike<T> {
  status: 'success' | 'error' | 'loading' | 'idle' = 'idle';
  error: any = undefined;
  __response: any = undefined;

  public query: QueryData;
  private connection: Connection;
  public promise!: Promise<T>;
  private fetchPolicy: FetchPolicy;
  private queryKey: string;
  private normalizer: any;

  constructor(
    connection: Connection,
    query: QueryData,
    options?: QueryOptions
  ) {
    makeObservable(this, {
      status: observable,
      data: computed,
      error: observable,
      __response: observable,
    });

    this.query = query;
    this.queryKey = this.query.queryKey;
    this.connection = connection;

    this.normalizer = normalizeResponseGenerator(this.store);

    const inCache = false;

    this.fetchPolicy = getFetchPolicy(query, options);

    switch (this.fetchPolicy) {
      case 'no-cache':
      case 'network-only':
        this.fetchResults();
        break;
      case 'cache-only':
        if (!inCache) {
          this.error = new Error(
            `No results for query ${this.query} found in cache, and policy is cache-only`
          );
          this.promise = Promise.reject(this.error);
        } else {
          this.useCachedResults();
        }
        break;
      case 'cache-and-network':
        this.fetchResults();
        break;
      case 'cache-first':
        if (inCache) {
          this.useCachedResults();
        } else {
          this.fetchResults();
        }
        break;
    }
  }

  get store() {
    return this.connection.cache;
  }

  clearData = (): void => {
    action(() => {
      if (this.store.queryCache.has(this.query.queryKey)) {
        this.store.queryCache.delete(this.query.queryKey);
      }
      this.__response = undefined;
    });
  };

  refetch = (): Promise<T> => {
    return Promise.resolve().then(
      action(() => {
        if (this.status !== 'loading') {
          this.fetchResults();
        }
        return this.promise;
      })
    );
  };

  get data() {
    let deflatedResponse;
    if (this.store.queryCache.has(this.query.queryKey)) {
      deflatedResponse = this.store.queryCache.get(this.query.queryKey);
    } else {
      deflatedResponse = this.__response;
    }

    return this.store.denormalize(deflatedResponse);
  }

  private fetchResults() {
    this.status = 'loading';
    let promise: Promise<T>;
    const existingPromise = this.store.__promises.get(this.queryKey);
    if (existingPromise) {
      promise = existingPromise as Promise<T>;
    } else {
      promise = this.connection.query(this.query);
      this.store.__pushPromise(promise, this.queryKey);
    }

    this.promise = promise;
    promise.then(
      action((data: any) => {
        this.status = 'success';
        this.error = false;
        let model;
        const isPaginatedData = data && data.pagination;

        if (this.query.collection === 'actions') {
          model = this.store.actions[this.query.operation];
        } else {
          model = this.store.models[this.query.collection];
        }

        let updatedResponse;

        if (model && this.query.operation.indexOf('delete') === -1) {
          model = isPaginatedData
            ? types.model('PaginationModel', {
                pagination: types.frozen(),
                data: types.array(model),
              })
            : model;

          // 1. Add id, __typename to response.
          const res = this.normalizer(data, model);

          // 2. Populate/Update the root store
          this.store.merge(res);

          const deflatedResponse = this.store.deflate(res);
          updatedResponse = deflatedResponse;
        } else {
          updatedResponse = data;
        }

        if (this.fetchPolicy !== 'no-cache') {
          if (isPaginatedData) {
            let prevData = this.store.queryCache.get(this.query.queryKey) ?? {
              data: [],
            };
            // Reset cache on refetch
            if (
              this.query.payload.cursor &&
              this.query.payload.cursor.id === undefined
            ) {
              prevData = { data: [] };
            }
            updatedResponse = {
              pagination: updatedResponse.pagination,
              data: prevData.data.concat(updatedResponse.data),
            };
            this.store.__cacheResponse(this.query.queryKey, updatedResponse);
          } else {
            this.store.__cacheResponse(this.query.queryKey, updatedResponse);
          }
        } else {
          this.__response = updatedResponse;
        }
      }),
      action((error: any) => {
        this.status = 'error';
        this.error = error;
      })
    );
  }

  private useCachedResults() {
    // this.data = this.store.merge(this.store.queryCache.get(this.queryKey));
    // this.promise = Promise.resolve(this.data!);
  }

  currentPromise() {
    return this.promise;
  }

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?:
      | ((value: T) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | undefined
      | null
  ): PromiseLike<TResult1 | TResult2>;
  then(onfulfilled: any, onrejected: any) {
    return this.promise.then(
      d => {
        this.store.__runInStoreContext(() => onfulfilled(d));
      },
      e => {
        this.store.__runInStoreContext(() => onrejected(e));
      }
    );
  }
}
