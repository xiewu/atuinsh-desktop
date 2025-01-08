import { useStore } from "@/state/store";
import Logger from "../logger";
import Mutex from "../mutex";
import { User } from "@/state/models";
import { DateTime } from "luxon";
import Runbook from "@/state/runbooks/runbook";
import { autobind } from "../decorators";
import SyncSet from "./sync_set";
import * as api from "@/api/api";

type Store = typeof useStore;

const SYNC_CHECK_INTERVAL = 10_000;
const NORMAL_SYNC_INTERVAL_SECS = 5 * 60;
const EARLY_SYNC_INTERVAL_SECS = 30;

/**
 * Manages synchronization by watching online/offline state, timers, etc. and kicking off a sync
 * pass as necessary. Creates a single `Synchronizer` instance for each sync pass.
 */
export default class SyncManager {
  private static syncMutexes: Map<string, Mutex> = new Map();
  private static instance: SyncManager | null = null;

  public static get(store: Store): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager(store);
    }

    return SyncManager.instance;
  }

  private readonly logger: Logger = new Logger("SyncManager", "#ff33cc", "#ff6677");
  private store: Store;
  private handlers: Function[] = [];
  private currentRunbookId: string | null = null;
  private workspaceId: string;
  private currentUser: User;
  private syncSet: SyncSet | null = null;
  private lastSync: DateTime | null = null;
  private startNextSyncEarly: boolean = false;
  private priorityRunbookIds = new Set<string>();
  private online: boolean = false;

  private constructor(store: Store) {
    this.store = store;

    this.currentUser = store.getState().user;
    this.workspaceId = store.getState().currentWorkspaceId;
    this.handlers.push(this.store.subscribe((state) => state.user, this.handleUserChange));
    this.handlers.push(
      this.store.subscribe((state) => state.currentRunbookId, this.handleCurrentRunbookIdChange, {
        fireImmediately: true,
      }),
    );
    // By checking the `online` state immediately, we begin syncinc if we're online
    this.handlers.push(
      this.store.subscribe((state) => state.online, this.handleOnlineChange, {
        fireImmediately: true,
      }),
    );
  }

  @autobind
  private async periodicSyncCheck() {
    if (this.shouldSync()) {
      // startSync() responsible for rescheduling
      await this.startSync();
    } else {
      setTimeout(this.periodicSyncCheck, SYNC_CHECK_INTERVAL);
    }
  }

  public static syncMutex(runbookId: string) {
    let mutex: Mutex;
    if (SyncManager.syncMutexes.has(runbookId)) {
      mutex = SyncManager.syncMutexes.get(runbookId)!;
    } else {
      mutex = new Mutex();
      SyncManager.syncMutexes.set(runbookId, mutex);
    }

    mutex.once("free").then(() => {
      SyncManager.syncMutexes.delete(runbookId);
    });

    return mutex;
  }

  public runbookUpdated(runbookId: string) {
    if (this.syncSet?.isWorking()) {
      this.syncSet.addRunbook(runbookId);
    } else {
      this.startNextSyncEarly = true;
      this.priorityRunbookIds.add(runbookId);
      if (this.shouldSync()) {
        this.startSync();
      }
    }
  }

  private async getRunbookIdsToSync() {
    const priorityIds = Array.from(this.priorityRunbookIds);
    const serverIds: string[] = await api.allRunbookIds();
    const localIds = await Runbook.allIdsInAllWorkspaces();

    // JS sets are ordered, so start with runbooks that have been updated on the server
    return new Set([...priorityIds, ...serverIds, ...localIds]);
  }

  public async startSync() {
    if (this.syncSet) {
      throw new Error("Sync already in progress");
    }

    this.startNextSyncEarly = false;
    const ids = await this.getRunbookIdsToSync();
    this.priorityRunbookIds.clear();
    this.syncSet = new SyncSet(ids, this.workspaceId, this.currentUser);
    this.syncSet.on("deleted", (runbookId: string) => {
      this.store.getState().deleteRunbookFromCache(runbookId);
    });
    this.syncSet.on("created", () => {
      this.store.getState().refreshRunbooks();
    });
    this.syncSet.setCurrentRunbookId(this.currentRunbookId);
    try {
      this.store.getState().setIsSyncing(true);
      this.syncSet.start();
      await this.syncSet.donePromise;
      this.lastSync = DateTime.now();
    } catch (err: any) {
      this.logger.error(`Synchronizer threw an error: ${err}`);
    } finally {
      this.syncSet.clearListeners();
      this.store.getState().setIsSyncing(false);
      this.store.getState().refreshRunbooks();
      this.syncSet = null;

      setTimeout(this.periodicSyncCheck, SYNC_CHECK_INTERVAL);
    }
  }

  private shouldSync(): boolean {
    const syncInterval = this.startNextSyncEarly
      ? EARLY_SYNC_INTERVAL_SECS
      : NORMAL_SYNC_INTERVAL_SECS;
    return this.online && this.syncSet === null && this.secondsSinceLastSync() >= syncInterval;
  }

  private secondsSinceLastSync(): number {
    return this.lastSync ? DateTime.now().diff(this.lastSync, "seconds").seconds : Infinity;
  }

  @autobind
  private handleUserChange(newUser: User, lastUser: User) {
    if (newUser.is(lastUser)) return;

    this.logger.info("Current user changed; resyncing all runbooks");
    if (this.syncSet) {
      this.syncSet.stop();
      this.syncSet = null;
    }

    // Allow any existing promise to settle
    setTimeout(() => this.startSync());
  }

  @autobind
  private handleCurrentRunbookIdChange(runbookId: string | null) {
    this.currentRunbookId = runbookId;

    if (this.syncSet) {
      this.syncSet.setCurrentRunbookId(runbookId);
    }
  }

  @autobind
  private handleOnlineChange(online: boolean) {
    this.online = online;
    if (online) {
      this.logger.debug("Connection to server established");
      this.startNextSyncEarly = true;
      if (this.shouldSync()) {
        this.startSync();
      }
    } else {
      this.logger.debug("Connection to server lost");
      if (this.syncSet) {
        this.logger.debug("Stopping sync");
        this.syncSet.stop();
        this.syncSet = null;
      }
    }
  }
}
