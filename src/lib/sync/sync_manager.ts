import { useStore } from "@/state/store";
import Logger from "../logger";
import Mutex from "../std/mutex";
import { User } from "@/state/models";
import { DateTime } from "luxon";
import Runbook from "@/state/runbooks/runbook";
import { autobind } from "../decorators";
import SyncSet from "./sync_set";
import * as api from "@/api/api";
import { clearTimeout, setTimeout } from "worker-timers";
import { processUnprocessedOperations } from "@/state/runbooks/operation_processor";
import { ConnectionState } from "@/state/store/user_state";
import Workspace from "@/state/runbooks/workspace";
import { SharedStateManager } from "../shared_state/manager";
import { AtuinSharedStateAdapter, OfflineSharedStateAdapter } from "../shared_state/adapter";
import WorkspaceFolder, { Folder } from "@/state/runbooks/workspace_folders";
import Operation, { createRunbook } from "@/state/runbooks/operation";
import { getGlobalOptions } from "../global_options";

type Store = typeof useStore;

const SYNC_CHECK_INTERVAL = 10_000;
const STUCK_SYNC_TIMEOUT = 15_000;
const NORMAL_SYNC_INTERVAL_SECS = 10 * 60;
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
  private syncing: boolean = false;
  private lastSync: DateTime | null = null;
  private startNextSyncEarly: boolean = false;
  private priorityRunbookIds = new Set<string>();
  private connectionState: ConnectionState;
  private focused: boolean | null = null;
  private periodicSyncTimeout: number | null = null;

  private constructor(store: Store) {
    this.store = store;

    this.currentUser = store.getState().user;
    this.workspaceId = store.getState().currentWorkspaceId;
    this.connectionState = store.getState().connectionState;
    this.handlers.push(
      this.store.subscribe((state) => state.connectionState, this.handleConnectionStateChange),
    );
    this.handlers.push(this.store.subscribe((state) => state.user, this.handleUserChange));
    this.handlers.push(
      this.store.subscribe((state) => state.currentRunbookId, this.handleCurrentRunbookIdChange, {
        fireImmediately: true,
      }),
    );
    this.handlers.push(
      this.store.subscribe((state) => state.focused, this.handleFocusedChange, {
        fireImmediately: true,
      }),
    );

    this.periodicSyncCheck();
  }

  @autobind
  private async periodicSyncCheck() {
    if (this.periodicSyncTimeout) {
      clearTimeout(this.periodicSyncTimeout);
      this.periodicSyncTimeout = null;
    }

    if (this.isSyncStuck()) {
      this.logger.error("Sync appears to be stuck; force killing");
      await this.syncSet?.stop(true);
      this.syncSet = null;
      this.syncing = false;
    }

    if (this.shouldSync()) {
      this.startSync();
    }

    this.periodicSyncTimeout = setTimeout(this.periodicSyncCheck, SYNC_CHECK_INTERVAL);
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

  isSyncStuck(): boolean {
    if (!this.syncSet || !this.syncSet.isWorking()) return false;

    const currentSyncTime = this.syncSet.currentSyncTimeMs();
    return currentSyncTime !== undefined && currentSyncTime > STUCK_SYNC_TIMEOUT;
  }

  public runbookUpdated(runbookId: string) {
    if (this.syncSet?.isWorking()) {
      this.syncSet.addRunbook(runbookId);
    } else {
      this.startNextSyncEarly = true;
      this.priorityRunbookIds.add(runbookId);
    }
  }

  private async getRunbookIdsToSync() {
    const serverIds: string[] = await api.allRunbookIds();
    const localIds = await Runbook.allIdsInAllWorkspaces();
    const priorityIds = Array.from(this.priorityRunbookIds);

    // JS sets are ordered, so start with runbooks that have been updated on the server
    return new Set([...priorityIds, ...serverIds, ...localIds]);
  }

  public async startSync() {
    if (this.syncing) {
      throw new Error("Sync already in progress");
    }

    if (this.connectionState !== ConnectionState.Online) return;

    this.syncing = true;
    this.startNextSyncEarly = false;

    try {
      this.store.getState().setIsSyncing(true);
      // The operation processor may create server models, so it needs to run first.
      await processUnprocessedOperations();
      // `processUnprocessedOperations` will exit early if we're offline;
      // double check before we continue.
      if (this.connectionState !== ConnectionState.Online) {
        this.logger.error("Syncing while offline; aborting");
        return;
      }

      // Before we sync the runbooks, we need to ensure that all the
      // workspaces from the server exist locally. We don't need to
      // send local workspaces to the server because we use the
      // operation system for that.
      await this.syncWorkspaces();
      const workspaceRunbookIds = await this.getRunbookIdsFromWorkspaces();
      const localRunbookIds = new Set(await Runbook.allIdsInAllWorkspaces());
      // Prioritize runbooks that exist in workspace folders but not locally
      for (const runbookId of workspaceRunbookIds) {
        if (!localRunbookIds.has(runbookId)) {
          this.priorityRunbookIds.add(runbookId);
        }
      }

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

      for (const runbookId of workspaceRunbookIds) {
        this.syncSet.addRunbook(runbookId);
      }

      if (this.connectionState !== ConnectionState.Online) {
        this.logger.error("Syncing while offline; aborting");
        return;
      }

      this.syncSet.start();
      await this.syncSet.donePromise;
      this.lastSync = DateTime.now();
    } catch (err: any) {
      this.logger.error(`Synchronizer threw an error: ${err}`);
    } finally {
      this.syncSet?.clearListeners();
      this.store.getState().setIsSyncing(false);
      this.store.getState().refreshRunbooks();
      this.syncSet = null;
      this.syncing = false;
    }
  }

  private async syncWorkspaces() {
    const serverWorkspaces = await api.getWorkspaces();
    const localWorkspaces = await Workspace.all();

    const localWorkspaceIds = new Set(localWorkspaces.map((w) => w.get("id")!));
    const serverWorkspaceIds = new Set(serverWorkspaces.map((w) => w.id));

    const idsToCreate = Array.from(serverWorkspaceIds).filter((id) => !localWorkspaceIds.has(id));
    const idsToUpdate = Array.from(serverWorkspaceIds).filter((id) => localWorkspaceIds.has(id));
    const idsToDelete = Array.from(localWorkspaceIds).filter((id) => !serverWorkspaceIds.has(id));

    for (const id of idsToCreate) {
      const workspace = serverWorkspaces.find((w) => w.id === id);
      if (workspace) {
        const ws = new Workspace({
          id: workspace.id,
          name: workspace.name,
          orgId: workspace.owner.type === "org" ? workspace.owner.id : null,
          permissions: workspace.permissions,
        });
        await ws.save();
      }
    }

    for (const id of idsToUpdate) {
      const localWorkspace = localWorkspaces.find((w) => w.get("id")! === id);
      const serverWorkspace = serverWorkspaces.find((w) => w.id === id);
      if (localWorkspace && serverWorkspace) {
        localWorkspace.set("name", serverWorkspace.name);
        localWorkspace.set("permissions", serverWorkspace.permissions);
        await localWorkspace.save();
      }
    }

    for (const id of idsToDelete) {
      const workspace = localWorkspaces.find((w) => w.get("id")! === id);
      if (workspace) {
        await workspace.del();
      }
    }

    // Reattach orphaned runbooks to their workspace folders
    const adapter = new OfflineSharedStateAdapter<any>();
    const workspaces = await Workspace.all();
    for (const workspace of workspaces) {
      const stateId = `workspace-folder:${workspace.get("id")}`;
      const runbooks = await Runbook.allFromWorkspace(workspace.get("id")!);
      const manager = SharedStateManager.getInstance<Folder>(stateId, adapter);
      const data = await manager.getDataOnce();
      const workspaceFolder = WorkspaceFolder.fromJS(data);
      for (const runbook of runbooks) {
        const node = workspaceFolder.getNode(runbook.id);
        if (node.isNone()) {
          // Reattach runbook to the workspace folder
          const changeRef = await manager.updateOptimistic(() => {
            workspaceFolder.createRunbook(runbook.id, null);
            return workspaceFolder.toJS();
          });
          if (changeRef) {
            const opData = createRunbook(workspace.get("id")!, null, runbook.id, changeRef);
            const op = new Operation({ operation: opData });
            await op.save();
          }
        }
      }
    }
  }

  private async getRunbookIdsFromWorkspaces(): Promise<string[]> {
    const workspaces = await Workspace.all();
    const promises = workspaces.map(async (workspace) => {
      const stateId = `workspace-folder:${workspace.get("id")}`;
      const manager = SharedStateManager.getInstance<Folder>(
        stateId,
        new AtuinSharedStateAdapter<Folder>(stateId),
      );
      return manager.getDataOnce();
    });

    const workspaceFoldersData = await Promise.all(promises);

    return workspaceFoldersData.flatMap((data) => {
      const workspaceFolder = WorkspaceFolder.fromJS(data);
      return workspaceFolder.getRunbooks();
    });
  }

  private shouldSync(): boolean {
    const syncInterval = this.startNextSyncEarly
      ? EARLY_SYNC_INTERVAL_SECS
      : NORMAL_SYNC_INTERVAL_SECS;
    return (
      this.connectionState === ConnectionState.Online &&
      !!this.focused &&
      !this.syncing &&
      !getGlobalOptions().noSync &&
      this.secondsSinceLastSync() >= syncInterval
    );
  }

  private secondsSinceLastSync(): number {
    return this.lastSync ? DateTime.now().diff(this.lastSync, "seconds").seconds : Infinity;
  }

  @autobind
  private async handleUserChange(newUser: User, lastUser: User) {
    if (newUser.is(lastUser)) return;

    this.logger.info("Current user changed; resyncing all runbooks");
    if (this.syncing) {
      await this.syncSet?.stop();
      this.syncSet = null;
      this.syncing = false;
    }

    this.startNextSyncEarly = true;
    this.periodicSyncCheck();
  }

  @autobind
  private handleCurrentRunbookIdChange(runbookId: string | null) {
    this.currentRunbookId = runbookId;

    if (this.syncSet) {
      this.syncSet.setCurrentRunbookId(runbookId);
    }
  }

  @autobind
  private handleConnectionStateChange(connectionState: ConnectionState) {
    if (connectionState === this.connectionState) return;
    this.connectionState = connectionState;

    if (connectionState === ConnectionState.Online) {
      this.logger.debug("Connection to server established");
      this.startNextSyncEarly = true;
      if (this.focused) {
        // Prevent sycning for 10 seconds to allow the connection to settle
        // and let the next periodic check pick up the sync
        this.lastSync = DateTime.now().minus({
          seconds: EARLY_SYNC_INTERVAL_SECS - SYNC_CHECK_INTERVAL / 1000 + 1,
        });

        // Reset the timer
        this.periodicSyncCheck();
      }
    } else {
      this.logger.debug("Connection to server lost");
      if (this.syncSet) {
        this.logger.debug("Stopping sync");
        this.syncSet.stop().then(() => {
          this.syncSet = null;
          this.syncing = false;
        });
      }
    }
  }

  @autobind
  private handleFocusedChange(focused: boolean) {
    if (focused === this.focused) return;
    this.focused = focused;
  }
}
