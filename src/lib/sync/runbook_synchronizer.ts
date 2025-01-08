import { RemoteRunbook, User } from "@/state/models";
import Logger from "../logger";
import SyncManager from "./sync_manager";
import Runbook from "@/state/runbooks/runbook";
import Snapshot from "@/state/runbooks/snapshot";
import * as api from "@/api/api";
import * as Y from "yjs";
import { PhoenixSynchronizer, SyncType } from "../phoenix_provider";
import { ydocToBlocknote } from "../ydoc_to_blocknote";
import AtuinEnv from "@/atuin_env";

function usernameFromNwo(nwo: string = "") {
  return nwo.split("/")[0];
}

export type SyncResult = {
  runbookId: string;
  action: "created" | "updated" | "deleted" | "nothing";
};

/**
 * Handles synchronization of a single runbook based on its ID.
 * The runbook doesn't not need to exist locally, it can exist only on the server.
 *
 * Calling `sync` will cause the synchronizer to attempt to obtain a lock on the mutex
 * for the runbook, so it is safe to create instances of this class and call `sync` outside
 * of the core synchronization process.
 */
export default class RunbookSynchronizer {
  public readonly runbookId: string;
  public isSyncing: boolean = false;
  private currentUser: User;
  private workspaceId: string;
  private resolve: Function | null = null;
  private reject: Function | null = null;
  private logger: Logger;

  constructor(runbookId: string, workspaceId: string, currentUser: User) {
    this.runbookId = runbookId;
    this.workspaceId = workspaceId;
    this.currentUser = currentUser;
    this.logger = new Logger(`RunbookSynchronizer ${runbookId}`, "#ff33cc", "#ff6677");
  }

  public sync(attemptYjsSync: boolean = false): Promise<SyncResult> {
    this.logger.debug("Acquiring sync lock...");
    const mutex = SyncManager.syncMutex(this.runbookId);
    return mutex.runExclusive(async () => {
      this.logger.debug("Lock acquired");
      const ret = await this.doSync(attemptYjsSync);
      this.logger.debug("Sync complete");
      return ret;
    });
  }

  private doSync(attemptYjsSync: boolean = false): Promise<SyncResult> {
    return new Promise(async (resolve, reject) => {
      this.isSyncing = true;
      this.resolve = resolve;
      this.reject = reject;

      let runbook = await Runbook.load(this.runbookId);
      const snapshots = await Snapshot.findByRunbookId(this.runbookId);

      let remoteRunbook: RemoteRunbook;
      try {
        remoteRunbook = await api.getRunbookID(this.runbookId);
      } catch (err: any) {
        if (err instanceof api.HttpResponseError && err.code === 404) {
          // Runbook either doesn't exist on the server,
          // or the user doesn't have permission to view it.
          // If the source of the local runbook is "hub" and the nwo specifies a different user,
          // then we should delete the local runbook.
          if (runbook) {
            const isHubRunbook = runbook.source === AtuinEnv.hubRunbookSource;
            const creatingUser = usernameFromNwo(runbook.sourceInfo || undefined);
            const createdBySomeoneElse = creatingUser !== this.currentUser.username;

            const shouldDelete = isHubRunbook && createdBySomeoneElse;
            if (shouldDelete) {
              await Runbook.delete(runbook.id);
              this.resolve({ runbookId: this.runbookId, action: "deleted" });
            } else {
              this.resolve({ runbookId: this.runbookId, action: "nothing" });
            }
          }
          return;
        } else {
          this.reject(err);
          return;
        }
      }

      let created = false;
      if (!runbook) {
        created = true;
        // Create local runbook from remote runbook
        runbook = await Runbook.create(this.workspaceId, false);
        runbook.id = remoteRunbook.id;
        runbook.name = remoteRunbook.name;
        runbook.source = AtuinEnv.hubRunbookSource;
        runbook.sourceInfo = remoteRunbook.nwo;
        runbook.created = new Date(remoteRunbook.client_created);
      }
      runbook.remoteInfo = JSON.stringify(remoteRunbook);

      // Compare local and remote snapshots
      const localSnapshots = snapshots.reduce<Record<string, Snapshot>>((acc, snap) => {
        acc[snap.tag] = snap;
        return acc;
      }, {});

      const remoteSnapshots = remoteRunbook.snapshots.reduce<Record<string, string>>(
        (acc, snap) => {
          acc[snap.tag] = snap.id;
          return acc;
        },
        {},
      );

      if (!this.isSyncing) return;

      // Ensure all local tags exist on server
      for (const localTag in localSnapshots) {
        const localSnapshot = localSnapshots[localTag];
        const remoteId = remoteSnapshots[localTag];

        if (remoteId && localSnapshot.id !== remoteId) {
          this.logger.error(`Local snapshot ${localTag} is different from remote snapshot`);
        }

        if (!remoteId) {
          await api.createSnapshot(localSnapshot);
        }
      }

      // Ensure all server tags exist locally
      for (const remoteTag in remoteSnapshots) {
        const localSnapshot = localSnapshots[remoteTag];

        if (!localSnapshot) {
          const remoteSnapshot = await api.getSnapshotById(remoteSnapshots[remoteTag]);
          await Snapshot.create({
            id: remoteSnapshot.id,
            tag: remoteSnapshot.tag,
            runbook_id: this.runbookId,
            content: JSON.stringify(remoteSnapshot.content),
          });
        }
      }

      if (attemptYjsSync && remoteRunbook.permissions.includes("update_content")) {
        this.logger.debug("Updating YJS document");
        const doc = new Y.Doc();
        if (runbook.ydoc) {
          Y.applyUpdate(doc, runbook.ydoc);
        }
        const provider = new PhoenixSynchronizer(this.runbookId, doc, false);
        const syncType: SyncType = await provider.once("synced");
        if (syncType !== "online") {
          this.logger.error("Failed to sync YJS document");
        } else {
          this.logger.debug("YJS sync completed with type:", syncType);
          const blocks = await ydocToBlocknote(doc);
          runbook.content = JSON.stringify(blocks);
        }

        provider.shutdown();
      }

      if (!this.isSyncing) return;
      await runbook.save();
      this.resolve({ runbookId: this.runbookId, action: created ? "created" : "updated" });
    });
  }

  public cancelSync() {
    if (this.isSyncing) {
      this.isSyncing = false;
      this.reject?.(new Error("Sync cancelled"));
    }
  }
}
