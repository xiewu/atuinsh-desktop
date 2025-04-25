import { User } from "@/state/models";
import Logger from "../logger";
import RunbookSynchronizer from "./runbook_synchronizer";
import Emittery from "emittery";

/**
 * Handles one synchronization pass for a set of runbook IDs.
 */
export default class SyncSet extends Emittery {
  private readonly logger: Logger = new Logger("Synchronizer", "#ff33cc", "#ff6677");
  private runbookIds: Set<string>;
  private currentRunbookId: string | null = null;
  private currentUser: User;
  private workspaceId: string;

  private syncQueue: RunbookSynchronizer[] = [];
  private activeSyncs: Map<string, RunbookSynchronizer> = new Map();
  private maxConcurrentSyncs: number;
  private working: boolean = false;

  public readonly donePromise: Promise<void>;
  private doneResolve!: Function;
  private doneReject!: Function;

  constructor(
    runbookIds: Set<string>,
    workspaceId: string,
    currentUser: User,
    maxConcurrentSyncs = 10,
  ) {
    super();
    this.runbookIds = runbookIds;
    this.workspaceId = workspaceId;
    this.currentUser = currentUser;
    this.maxConcurrentSyncs = maxConcurrentSyncs;
    this.donePromise = new Promise((resolve, reject) => {
      this.doneResolve = resolve;
      this.doneReject = reject;
    });
  }

  public isWorking() {
    return this.working;
  }

  public setCurrentRunbookId(runbookId: string | null) {
    this.currentRunbookId = runbookId;
  }

  public addRunbook(runbookId: string) {
    const isInQueue = this.syncQueue.some((sync) => sync.runbookId === runbookId);
    const isActive = this.activeSyncs.has(runbookId);
    if (!isInQueue && !isActive && this.working) {
      this.runbookIds.add(runbookId);
      this.syncQueue.push(new RunbookSynchronizer(runbookId, this.workspaceId, this.currentUser));
      this.tryStartNextSync();
    }
  }

  public removeRunbook(runbookId: string) {
    this.syncQueue = this.syncQueue.filter((sync) => sync.runbookId !== runbookId);
    if (this.activeSyncs.has(runbookId)) {
      const sync = this.activeSyncs.get(runbookId);
      sync?.cancelSync();
      this.activeSyncs.delete(runbookId);
    }
  }

  public currentSyncTimeMs(): number | undefined {
    if (this.activeSyncs.size === 0) return undefined;

    // Return the longest running sync time
    let longestTime = -Infinity;
    for (const sync of this.activeSyncs.values()) {
      const time = sync.syncTimeMs();
      if (time > longestTime) {
        longestTime = time;
      }
    }
    return longestTime === -Infinity ? undefined : longestTime;
  }

  private async processSynchronizer(sync: RunbookSynchronizer) {
    const id = sync.runbookId;
    this.activeSyncs.set(id, sync);
    this.logger.debug(`Starting sync for runbook ${id}. Active syncs: ${this.activeSyncs.size}`);

    let doYjsSync = true;
    if (this.currentRunbookId === id) {
      doYjsSync = false;
    }

    try {
      const result = await sync.sync(doYjsSync);
      this.logger.debug("Sync result:", result);
      this.emit(result.action, result.runbookId);
    } catch (err: any) {
      this.logger.error(`Failed to sync runbook ${id}: ${err.message}`);
    } finally {
      this.logger.debug("Sync completed. Deleting active sync.");
      this.activeSyncs.delete(id);
      this.logger.debug(
        `Completed sync for runbook ${id}. Remaining active syncs: ${this.activeSyncs.size}`,
      );

      if (this.working) {
        this.tryStartNextSync();
        // Always check if we're done after a synchronizer completes
        this.checkIfDone();
      }
    }
  }

  private tryStartNextSync() {
    if (!this.working || this.syncQueue.length === 0) return;

    const availableSlots = this.maxConcurrentSyncs - this.activeSyncs.size;
    this.logger.debug(`Available slots: ${availableSlots}, Queue length: ${this.syncQueue.length}`);

    for (let i = 0; i < availableSlots && i < this.syncQueue.length; i++) {
      const sync = this.syncQueue.shift();
      if (sync) {
        this.processSynchronizer(sync);
      }
    }
  }

  private checkIfDone() {
    if (this.syncQueue.length === 0 && this.activeSyncs.size === 0 && this.working) {
      this.working = false;
      this.logger.info(`Finished sync process for all runbooks`);
      this.doneResolve();
    }
  }

  public async start() {
    this.syncQueue = Array.from(this.runbookIds).map(
      (id) => new RunbookSynchronizer(id, this.workspaceId, this.currentUser),
    );

    if (this.syncQueue.length === 0) {
      this.logger.debug("No runbooks to sync");
      this.doneResolve();
      return;
    }

    this.working = true;
    this.logger.debug(
      `Starting to sync ${this.syncQueue.length} runbooks with max ${this.maxConcurrentSyncs} concurrent syncs`,
    );

    this.tryStartNextSync();
    // Check immediately in case all synchronizers were started
    this.checkIfDone();
  }

  public async stop(forceStop = false) {
    if (forceStop) {
      for (const sync of this.activeSyncs.values()) {
        sync.cancelSync();
        sync.forceUnlockMutex();
      }
    }

    this.working = false;

    if (this.syncQueue.length > 0 || this.activeSyncs.size > 0) {
      this.logger.debug("Sync process cancelled before completion");
      this.doneReject(new Error("Synchronizer cancelled"));
    }

    return this.donePromise;
  }
}
