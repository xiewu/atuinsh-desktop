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

  private syncQueue: any[] = [];
  private currentSync: RunbookSynchronizer | null = null;
  private working: boolean = false;

  public readonly donePromise: Promise<void>;
  private doneResolve!: Function;
  private doneReject!: Function;

  constructor(runbookIds: Set<string>, workspaceId: string, currentUser: User) {
    super();
    this.runbookIds = runbookIds;
    this.workspaceId = workspaceId;
    this.currentUser = currentUser;
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
    if (!isInQueue && this.working) {
      this.runbookIds.add(runbookId);
      this.syncQueue.push(new RunbookSynchronizer(runbookId, this.workspaceId, this.currentUser));
    }
  }

  public removeRunbook(runbookId: string) {
    this.syncQueue = this.syncQueue.filter((sync) => sync.runbookId !== runbookId);
  }

  public async start() {
    this.syncQueue = Array.from(this.runbookIds).map(
      (id) => new RunbookSynchronizer(id, this.workspaceId, this.currentUser),
    );
    if (this.syncQueue.length === 0) {
      this.logger.debug("No runbooks to sync");
      return;
    }

    this.working = true;
    this.logger.debug(`Starting to sync ${this.syncQueue.length} runbooks`);

    let count = 0;
    while (this.syncQueue.length > 0) {
      if (this.working) {
        this.currentSync = this.syncQueue.shift();
        if (!this.currentSync) return; // to make TS happy

        const id = this.currentSync.runbookId;

        let doYjsSync = true;
        if (this.currentRunbookId === id) {
          doYjsSync = false;
        }

        try {
          const result = await this.currentSync.sync(doYjsSync);
          this.emit(result.action, result.runbookId);
        } catch (err: any) {
          this.logger.error(`Failed to sync runbook ${id}: ${err.message}`);
        }
        count++;
      } else {
        // Something has called `stop()`
        this.doneReject(new Error("Synchronizer cancelled"));
        return;
      }
    }

    this.working = false;
    this.logger.info(`Finished sync process for ${count} runbooks`);
    this.doneResolve();
  }

  public stop() {
    this.working = false;
  }
}
