import {
  applyPatch,
  IAnyModelType,
  IAnyType,
  IMapType,
  onPatch,
  types,
} from 'mobx-state-tree';
import normalize from 'mobx-state-tree-normalizr';
import { Cache } from './index';
import { QueryData } from '../query';
import { exerimentalMSTViews } from './experimental-mst-views';
import { GETTER_QUERIES } from '../query/index';

const QUERY_CACHE_NAME = 'queryCache';
const DB_NAME = 'MSTCache';

export type DBInstance = Cache;

type ICreateDBParams = { models: Array<IAnyModelType>; initialValue?: any };

type IModelKeyValue = {
  [key: string]: IAnyModelType;
};

type IModelMaps = {
  // Because Type 'IAnyType' is not assignable to type 'IAnyModelType'.ts(2322)
  [key: string]: IMapType<any>;
};

let modelKeyValue: IModelKeyValue = {};

const createDB = ({ models, initialValue }: ICreateDBParams) => {
  let queryCache: Array<IAnyType> = [];
  let modelMaps: IModelMaps = {};

  models.forEach(model => {
    modelKeyValue[model.name] = model;
    modelMaps[model.name] = types.map(model);
    queryCache.push(types.safeReference(model));
    queryCache.push(types.array(types.safeReference(model)));
  });

  modelMaps[QUERY_CACHE_NAME] = types.map(types.union(...queryCache));

  const DBModel = types
    .model(DB_NAME, modelMaps)
    .actions(self => {
      return {
        has(query: QueryData) {
          return self[QUERY_CACHE_NAME].has(query.getHash());
        },
        get(query: QueryData) {
          return self[QUERY_CACHE_NAME].get(query.getHash());
        },
        put(query: QueryData, data: any) {
          const model = modelKeyValue[query.collection];

          //@ts-ignore
          const normalizedResponse = self._populate({ data, model });

          // Getter queries add to the cache
          if (GETTER_QUERIES.includes(query.operation)) {
            self[QUERY_CACHE_NAME].set(query.getHash(), normalizedResponse);
          } else if (query.operation.includes('update')) {
            const collection = query.collection;
            //@ts-ignore
            self._save(collection, data);
          }
        },
        _save(name: string, data: any) {
          const prevData = self[name].get(data.id);
          if (prevData) {
            self[name].set(data.id, { ...prevData, ...data });
          } else {
            self[name].set(data.id, data);
          }
        },
        _populate({ data, model }: { data: any; model: any }) {
          const { entities, result } = normalizeResponse(data, model);
          for (let key in entities) {
            const modelData = entities[key];
            for (let id in modelData) {
              //@ts-ignore
              self._save(key, modelData[id]);
            }
          }

          let normalizedResponse: any;
          if (Array.isArray(result)) {
            normalizedResponse = result.map((id: any) => {
              return self[model.name].get(id);
            });
          } else {
            normalizedResponse = self[model.name].get(result);
          }

          return normalizedResponse;
        },
        _optimisticUpdate(name: string, payload: any) {
          let reverse = { reversePatch: {} };

          const removeListener = onPatch(
            self[name].get(payload.where.id),
            (_patch, reversePatch) => {
              reverse.reversePatch = reversePatch;
            }
          );

          //@ts-ignore
          self._save(name, { id: payload.where.id, ...payload.data });

          removeListener();
          return function revert() {
            applyPatch(
              self[name].get(payload.where.id),
              //@ts-ignore
              reverse.reversePatch
            );
          };
        },
      };
    })
    .views(exerimentalMSTViews);

  const db = DBModel.create(initialValue);
  return db;
};

const normalizeResponse = (data: any, model: IAnyModelType) => {
  let mstModel: any = model;
  if (Array.isArray(data)) {
    mstModel = [model];
  }
  const result = normalize(data, mstModel);
  return result;
};

export { createDB };
