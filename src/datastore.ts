import Emittery from "emittery";
import Runbook from "./state/runbooks/runbook";

// Expand this to include other models as needed
type CacheType = "runbook";
// Any given model must have an `id` field and extend `Emittery`
type Model<T> = T & Emittery & { id: string };
type ModelMap<T> = Map<string, Promise<CachedModel<T>>>;
type Finder<T> = (id: string) => Promise<Model<T> | null | undefined>;
type DatastoreResult<T> = Promise<CachedModel<T> | undefined>;

/**
 * The `Datastore` is a synchronization layer for database lookups that may
 * happen in multiple places in the app. `Datastore` ensures that every query
 * for a model with a given ID returns the same instance of that model, and
 * when that model is saved (e.g. it emits a `saved` event), all instances
 * are updated to the new version of the model.
 *
 * `Datastore` get methods should return a `DatastoreResult<T>`, which is a
 * `Promise` that resolves to either a `CachedModel<T>` instance that wraps the
 * underlying model or `undefined`
 *
 * For cache management, when you get a copy of a model, you should call
 * `addRef` with the model, and when you are done with the model, you should
 * call `removeRef` with the same model. `Datastore` will evict items from its
 * cache when the reference count drops to zero.
 *
 * `Datastore` is a singleton and should be accessed via `Datastore.get()`.
 *
 * @see CachedModel
 */
export default class Datastore extends Emittery {
  static instance: Datastore;
  private cache: Map<CacheType, ModelMap<any>> = new Map();
  private refCount: Map<string, number> = new Map();

  static get() {
    if (!Datastore.instance) {
      Datastore.instance = new Datastore();
    }

    return Datastore.instance;
  }

  constructor() {
    super();
  }

  public async getRunbook(id?: string | null): DatastoreResult<Runbook> {
    if (!id) return;

    const cachedRunbook = await this.doCache("runbook", id, (id) => Runbook.load(id));
    if (cachedRunbook) {
      return cachedRunbook;
    }
  }

  public addRef(model: CachedModel<any>) {
    if (this.refCount.has(model.key)) {
      this.refCount.set(model.key, this.refCount.get(model.key)! + 1);
    } else {
      this.refCount.set(model.key, 1);
    }
  }

  public removeRef(model: CachedModel<any>) {
    if (this.refCount.has(model.key)) {
      this.refCount.set(model.key, this.refCount.get(model.key)! - 1);

      if (this.refCount.get(model.key)! <= 0) {
        const [type, id] = model.key.split(":");
        const cache = this.getCache(type as CacheType);
        cache.delete(id);
        this.refCount.delete(model.key);
      }
    }
  }

  private doCache<T extends Emittery>(
    type: CacheType,
    id: string,
    finder: Finder<T>,
  ): Promise<CachedModel<T> | undefined> {
    const cache = this.getCache<T>(type);
    if (cache.has(id)) {
      return cache.get(id)!;
    } else {
      // Generate a promise that we can add to the cache synchronously
      // so that other requests for the same model can just use that promise.
      const promise = new Promise<CachedModel<T> | undefined>(async (resolve) => {
        const model = await finder(id);

        if (model) {
          const cachedModel = new CachedModel(type, model, finder);
          model.once("saved").then(() => {
            this.refreshModel(type, cachedModel);
          });
          resolve(cachedModel);
        } else {
          resolve(undefined);
        }
      });

      // Cast the promise to a `Promise<CachedModel<T>>` so that we can store
      // the promise in the cache; if the value turns out to be undefined we
      // will rmeove it from the cache immediately.
      cache.set(id, promise as Promise<CachedModel<T>>);

      promise.then((value) => {
        if (!value && cache.get(id) == promise) {
          cache.delete(id);
        }
      });

      return promise;
    }
  }

  private getCache<T>(type: CacheType): ModelMap<T> {
    if (this.cache.has(type)) {
      return this.cache.get(type)!;
    } else {
      const modelMap: ModelMap<T> = new Map();
      this.cache.set(type, modelMap);
      return modelMap;
    }
  }

  private async refreshModel<T>(type: CacheType, cachedModel: CachedModel<T>) {
    const id = cachedModel.model.id;
    const finder = cachedModel.finder;
    const newModel = await finder(id);
    if (newModel) {
      cachedModel.update(newModel);
      newModel.once("saved").then(() => {
        this.refreshModel(type, cachedModel);
      });
    } else {
      this.getCache<T>(type).delete(id);
    }

    this.emit(`${type}:${id}`, cachedModel);
  }
}

/**
 * A `CachedModel` is a small wrapper around a model instance that also includes
 * the key used to cache the model and a finder function that can be used to
 * fetch the new version of the model.
 *
 * @see Datastore
 */
export class CachedModel<T> {
  public readonly key: string;
  public readonly finder: Finder<T>;
  private _model: Model<T>;

  constructor(type: CacheType, model: Model<T>, finder: Finder<T>) {
    this.key = `${type}:${model.id}`;
    this._model = model;
    this.finder = finder;
  }

  public update(newModel: Model<T>) {
    this._model = newModel;
  }

  public get model() {
    return this._model;
  }
}
