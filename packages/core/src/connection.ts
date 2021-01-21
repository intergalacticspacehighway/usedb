import { QueryData } from './query';
import { Binding } from './binding';
import { Cache } from './cache';
// import { isNil } from 'lodash';
import { DBInstance } from './cache/mst-cache';

export class Connection {
  private bind: Binding;
  cache: Cache;
  constructor({ bind, db }: { bind: Binding; db: DBInstance }) {
    this.bind = bind;
    this.cache = db;
  }
  setBinding(bind: Binding) {
    this.bind = bind;
  }
  getAllCollections(): Promise<any> {
    return this.bind.getAllCollections();
  }
  query(query: QueryData, _disableCache?: boolean): Promise<any> {
    // if (
    //   !disableCache &&
    //   query.fetchPolicy === 'cache-and-network' &&
    //   this.cache.has(query)
    // ) {
    //   let cachedValue = this.cache.get(query);
    //   if (!isNil(cachedValue)) {
    //     return new Promise((resolve: any, _reject: any) => {
    //       resolve(cachedValue);
    //       this.bind.perform(query).then(resp => {
    //         this.cache.put(query, resp);
    //       });
    //     });
    //   }
    // }

    return new Promise((resolve: any, reject: any) => {
      this.bind
        .perform(query)
        .then(resp => {
          const normalizedResponse = this.cache.put(query, resp);
          resolve(normalizedResponse);
        })
        .catch(error => {
          console.log('error ', error);
          reject(error);
        });
    });
  }
}
