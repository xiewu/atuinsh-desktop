import * as Y from "yjs";
import * as awarenessProtocol from "y-protocols/awareness";

import SocketManager, { WrappedChannel } from "../socket";
import Logger from "@/lib/logger";
import Emittery from "emittery";
import SyncManager from "./sync/sync_manager";
import { timeoutPromise } from "./utils";
import { autobind } from "./decorators";

type AwarenessData = { added: number[]; updated: number[]; removed: number[] };

export type PresenceUserInfo = { id: string; username: string; avatar_url: string };
type PresenceEntry = { metas: any[]; user: PresenceUserInfo };
type PresenceEntries = Record<string, PresenceEntry>;
type PresenceDiff = { joins: PresenceEntries; leaves: PresenceEntries };

export type SyncType = "online" | "offline" | "timeout" | "error";

/**
 * Handles synchronization of a Y.Doc with the server over a Phoenix channel.
 *
 * @emits `"synced", SyncType ("online" | "offline" | "timeout" | "error")`
 */
export class PhoenixSynchronizer extends Emittery {
  protected connected: boolean;
  protected channel: WrappedChannel;
  protected subscriptions: any[] = [];
  protected readonly runbookId: string;
  protected readonly requireLock: boolean;
  public readonly doc: Y.Doc;
  protected readonly awareness: awarenessProtocol.Awareness;
  protected logger: Logger;
  protected isShutdown: boolean = false;
  protected unlock: Function | null = null;

  constructor(runbookId: string, doc: Y.Doc, requireLock: boolean = true, isProvider = false) {
    super();
    if (isProvider) {
      this.logger = new Logger(`PhoenixProvider (${runbookId})`, "blue", "cyan");
      this.logger.debug("Creating new provider instance");
    } else {
      this.logger = new Logger(`PhoenixSynchronizer (${runbookId})`, "blue", "cyan");
      this.logger.debug("Creating new synchronizer instance");
    }

    const manager = SocketManager.get();
    this.subscriptions.push(manager.onConnect(this.onSocketConnected));
    this.subscriptions.push(manager.onDisconnect(this.onSocketDisconnected));
    this.connected = manager.isConnected();

    this.runbookId = runbookId;
    this.doc = doc;
    this.awareness = new awarenessProtocol.Awareness(this.doc);
    this.requireLock = requireLock;

    this.channel = manager.channel(`doc:${this.runbookId}`);

    setTimeout(() => this.init());
  }

  init() {
    if (this.isShutdown) return;

    if (this.connected) {
      this.onSocketConnected();
    } else {
      this.logger.debug("Socket disconnected; starting in offline mode");
      this.startOffline();
    }
  }

  startOffline() {
    this.emit("synced", "offline");
  }

  @autobind
  async onSocketConnected() {
    if (this.isShutdown) return;

    this.connected = true;

    this.logger.debug("Socket connected");
    if (this.channel.state == "closed") {
      try {
        await this.channel.join(10000);

        // Either this is the first connection, or we're reconnecting. Either way,
        // we need to resync with the remote document.
        this.resync();
      } catch (err) {
        this.logger.error("Failed to join doc channel", err);
        this.logger.debug("Starting in offline mode");
        this.startOffline();
      }
    } else {
      this.resync();
    }
  }

  @autobind
  onSocketDisconnected() {
    if (this.connected) {
      this.logger.warn("Socket disconnected");
      this.connected = false;
    }
  }

  async resync() {
    if (this.requireLock) {
      this.logger.debug("Acquiring sync lock...");
      this.unlock = await SyncManager.syncMutex(this.runbookId).lock();
      if (this.isShutdown) {
        this.unlock();
        this.unlock = null;
        return;
      }
    }
    this.logger.info("Starting resync");

    try {
      const timerPromise = timeoutPromise(5000, false);
      const resyncPromise = this.doResync();
      const didResync = await Promise.race([timerPromise, resyncPromise]);
      if (!didResync) {
        this.logger.error("Resync timed out");
        this.emit("synced", "timeout");
      } else {
        this.emit("synced", "online");
      }
    } catch (err) {
      this.logger.error("Failed to resync", err);
      this.emit("synced", "error");
    } finally {
      if (this.unlock) {
        this.unlock();
        this.unlock = null;
      }
    }
  }

  async doResync() {
    // Step 1: Get our state vector and send it to the server in exchange for
    // the server's state vector
    const stateVector = Y.encodeStateVector(this.doc);
    this.logger.debug(`⬆️ Sending state vector (${stateVector.byteLength} bytes)`);
    const serverVector = await this.channel.push("sync_step_1", stateVector).receiveBin();
    this.logger.debug(`⬇️ Received server state vector (${serverVector.byteLength} bytes)`);

    // Step 2: Get the diff between our document and the server's document
    // and exchange it for the diff from the server
    const diff = Y.encodeStateAsUpdate(this.doc, serverVector);
    this.logger.debug(`⬆️ Sending state diff (${diff.byteLength} bytes)`);
    const serverDiff = await this.channel.push("sync_step_2", diff).receiveBin();
    this.logger.debug(`⬇️ Received server diff (${serverDiff.byteLength} bytes)`);

    // Step 3: Apply the diff from the server
    Y.applyUpdate(this.doc, serverDiff, this);
    this.logger.info("Resync complete");
    return true;
  }

  shutdown() {
    this.logger.debug("Shutting down");
    if (this.unlock) {
      this.unlock();
    }
    this.isShutdown = true;
    // disconnect from the server
    this.channel.leave();
    this.subscriptions.forEach((unsub) => unsub());
    // disconnect from the ydoc
    // shut down the event emitter
    this.clearListeners();
  }
}

/**
 * As a sublcass of PhoenixSynchronizer, this class handles synchronization of a Y.Doc
 * with the server over a Phoenix channel. It also serves as a two-way synchronization provider
 * for BlockNote.
 *
 * @emits `"synced", SyncType ("online" | "offline" | "timeout" | "error")`
 * @emits `"remote_update"` when a remote update is received
 */
export default class PhoenixProvider extends PhoenixSynchronizer {
  constructor(runbookId: string, doc: Y.Doc, requireLock: boolean = true) {
    super(runbookId, doc, requireLock, true);

    this.doc.on("update", this.handleDocUpdate);
    this.awareness.on("update", this.handleAwarenessUpdate);

    this.subscriptions.push(this.channel.on("apply_update", this.handleIncomingUpdate));
    this.subscriptions.push(this.channel.on("awareness", this.handleIncomingAwareness));
    this.subscriptions.push(this.channel.on("presence_state", this.handlePresenceState));
    this.subscriptions.push(this.channel.on("presence_diff", this.handlePresenceDiff));
  }

  @autobind
  handleDocUpdate(update: Uint8Array, origin: any) {
    if (origin === this || !this.channel) return;

    if (this.connected) {
      this.channel.push("client_update", update.buffer);
    }
  }

  @autobind
  handleAwarenessUpdate({ added, updated, removed }: AwarenessData, origin: any) {
    if (origin === this || !this.channel) return;

    const changedClients = added.concat(updated).concat(removed);
    if (this.connected) {
      this.channel.push(
        "client_awareness",
        awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients).buffer,
      );
    }
  }

  @autobind
  handleIncomingUpdate(payload: Uint8Array) {
    Y.applyUpdate(this.doc, payload, this);
    this.emit("remote_update");
  }

  @autobind
  handleIncomingAwareness(payload: Uint8Array) {
    awarenessProtocol.applyAwarenessUpdate(this.awareness, payload, this);
  }

  @autobind
  handlePresenceState(presences: PresenceEntries) {
    for (const id in presences) {
      this.emit("presence:join", presences[id].user);
    }
  }

  @autobind
  handlePresenceDiff(diff: PresenceDiff) {
    for (const id in diff.joins) {
      this.emit("presence:join", diff.joins[id].user);
    }

    for (const id in diff.leaves) {
      this.emit("presence:leave", diff.joins[id].user);
    }
  }

  shutdown() {
    super.shutdown();
    this.doc.off("update", this.handleDocUpdate);
    this.awareness.off("update", this.handleAwarenessUpdate);
  }
}
