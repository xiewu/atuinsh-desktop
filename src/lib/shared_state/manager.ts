import * as jsondiffpatch from "jsondiffpatch";
import Emittery, { UnsubscribeFunction } from "emittery";
import { SharedStateAdapter } from "./adapter";
import { ChangeRef, ServerUpdate, Version, Event, SharableState, OptimisticUpdate } from "./types";
import { uuidv7 } from "uuidv7";
import { autobind } from "../decorators";
import Logger from "../logger";
import {
  getSharedStateDocument,
  pushOptimisticUpdate,
  removeOptimisticUpdate,
  updateSharedStateDocument,
} from "./commands";

function applyOptimisticUpdates<T>(data: T, updates: Array<OptimisticUpdate>) {
  for (const update of updates) {
    jsondiffpatch.patch(data, update.delta);
  }
  return data;
}

/**
 * A manager for a shared state. The state must be an object (not an array) that can be
 * serialized to JSON.
 *
 * @param T - The type of the shared state.
 * @param stateId - The ID of the shared state document.
 * @param adapter - The adapter for managing the shared state. See {@link SharedStateAdapter}.
 */
export class SharedStateManager<T extends SharableState> {
  public readonly stateId: string;

  private emitter = new Emittery();
  private unsub: UnsubscribeFunction | null = null;
  private adapter: SharedStateAdapter<T>;

  private _data: T = {} as T;
  private _optimisticData: T | null = null;

  private optimisticUpdates: Array<OptimisticUpdate> = [];
  private version: Version = -1;
  private cached_updates: Map<Version, ServerUpdate> = new Map();
  private logger: Logger;

  private shutdown = false;
  private resyncing = false;

  constructor(stateId: string, adapter: SharedStateAdapter<T>) {
    this.stateId = stateId;
    this.adapter = adapter;
    this.logger = new Logger(`SharedStateManager: ${stateId}`);
    this.setup();
  }

  /**
   * Subscribe to updates to the shared state.
   *
   * @param callback - A function that will be called with the latest state.
   * @returns A function that can be called to cancel the subscription.
   */
  public subscribe(callback: (data: T) => void): UnsubscribeFunction {
    return this.emitter.on(Event.UPDATE, callback);
  }

  /**
   * `updateOptimistic` can be used to update the stored data; the change to the data
   * is stored locally as an optimistic update. When the adapter acknowledges the update
   * (by sending a delta with the same change reference), the optimistic update is applied
   * permanently to the shared state and the temporary update is discarded, even if the
   * delta from the server is different from the one stored in the optimistic update.
   *
   * @param callback - A function that **synchronously** applies an optimistic update to the data.
   * @returns A promise to the change reference for the update.
   */
  @autobind
  public async updateOptimistic(callback: (data: T) => void): Promise<ChangeRef> {
    const orig = jsondiffpatch.clone(this.data) as T;
    const clone = jsondiffpatch.clone(this.data) as T;

    callback(clone);

    const update = {
      sourceVersion: this.version,
      delta: jsondiffpatch.diff(orig, clone),
      changeRef: uuidv7(),
    };

    await pushOptimisticUpdate(this.stateId, update);

    this.optimisticUpdates.push(update);
    this.setOptmisticData();
    this.emitter.emit(Event.UPDATE, this.data);
    return update.changeRef;
  }

  public destroy() {
    this.logger.debug("Shutting down");
    this.shutdown = true;
    this.adapter.destroy();
    this.unsub?.();
    this.emitter.clearListeners();
  }

  /**
   * Get the current state, including optimistic updates.
   */
  get data(): T {
    return this._optimisticData || this._data;
  }

  private async setData(data: T, version: Version) {
    this._data = data;
    this.version = version;

    await updateSharedStateDocument(this.stateId, data, version);

    this.setOptmisticData();
    this.emitter.emit(Event.UPDATE, this.data);
  }

  private setOptmisticData() {
    if (this.optimisticUpdates.length > 0) {
      const clone = jsondiffpatch.clone(this._data) as T;
      this._optimisticData = applyOptimisticUpdates(clone, this.optimisticUpdates);
    } else {
      this._optimisticData = null;
    }
  }

  private async setup() {
    const document = await getSharedStateDocument<T>(this.stateId);
    if (document) {
      this.setData(document.value, document.version);
      this.optimisticUpdates = document.optimisticUpdates;
    }

    await this.adapter.init();
    this.unsub = this.adapter.subscribe(this.handleUpdate);

    this.resync();
  }

  private async resync() {
    if (this.shutdown || this.resyncing) return;

    this.resyncing = true;
    this.logger.info("Resyncing...");

    let newVersion: Version;
    let newData: T;

    while (true) {
      const resync = await this.adapter.resync(this.version);

      if (this.shutdown) return;

      this.logger.debug(`Resynced; received version ${resync.version}`);
      newVersion = resync.version;
      newData = resync.data;

      const maxVersion = Math.max(...this.cached_updates.keys());
      if (maxVersion > newVersion) {
        this.logger.debug(
          `Applying cached updates for versions ${newVersion + 1} through ${maxVersion}...`,
        );
        for (let i = newVersion + 1; i <= maxVersion; i++) {
          const update = this.cached_updates.get(i);
          if (update && Object.keys(update.delta as object).length > 0) {
            jsondiffpatch.patch(newData, update.delta);
            newVersion = i;
          } else if (update) {
            this.logger.debug(`Skipping cached update for version ${i}; delta is empty`);
            newVersion = i;
          } else {
            this.logger.warn(`Missing cached update for version ${i}; attempting resync again`);
            continue;
          }
        }
      }

      break;
    }

    for (const v of this.cached_updates.keys()) {
      if (v < newVersion) {
        this.cached_updates.delete(v);
      }
    }

    this.resyncing = false;

    this.setData(newData, newVersion);
  }

  @autobind
  private async handleUpdate(payload: ServerUpdate) {
    if (this.shutdown) return;

    const expectedVersion = this.version + 1;
    if (payload.version < expectedVersion) {
      this.logger.debug(
        `Ignoring update; version ${payload.version} is less than expected version ${expectedVersion}`,
      );
      return;
    } else if (payload.version > expectedVersion) {
      this.logger.debug(
        `Unexpected update; version ${payload.version} is greater than expected version ${expectedVersion}`,
      );
      if (this.resyncing) {
        this.cached_updates.set(payload.version, payload);
      } else {
        await this.resync();
      }
    } else {
      this.logger.debug(`Applying update; final version: ${payload.version}`);

      // If this update was sent as a response to an optimistic update,
      // remove the optimistic update from the list on both the frontend and backend.
      await removeOptimisticUpdate(this.stateId, payload.change_ref);
      this.optimisticUpdates = this.optimisticUpdates.filter(
        (update) => update.changeRef !== payload.change_ref,
      );

      // JsonDiffEx can send an empty delta when the data hasn't change;
      // `jsondiffpatch.patch()` will throw an error in this case, so we need to check for an empty delta.
      if (Object.keys(payload.delta as object).length > 0) {
        const clone = jsondiffpatch.clone(this._data) as T;
        jsondiffpatch.patch(clone, payload.delta);

        if (!this.shutdown) {
          this.setData(clone, payload.version);
        }
      } else {
        this.version = payload.version;
      }
    }
  }
}
