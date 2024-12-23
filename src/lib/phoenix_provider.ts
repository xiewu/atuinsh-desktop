import * as Y from "yjs";
import * as awarenessProtocol from "y-protocols/awareness";

import SocketManager, { WrappedChannel } from "../socket";
import Logger from "@/lib/logger";
import Emittery from "emittery";

function timeoutPromise<T>(ms: number, resolveValue: T) {
  return new Promise<T>((resolve) => {
    setTimeout(() => resolve(resolveValue), ms);
  });
}

type AwarenessData = { added: number[]; updated: number[]; removed: number[] };

export default class PhoenixProvider extends Emittery {
  private connected: boolean;
  private channel: WrappedChannel;
  private subscriptions: any[] = [];
  private readonly runbookId: string;
  private readonly doc: Y.Doc;
  private readonly awareness: awarenessProtocol.Awareness;
  private readonly logger: Logger;

  constructor(runbookId: string, doc: Y.Doc) {
    super();
    this.logger = new Logger(`PhoenixProvider (${runbookId})`, "blue", "cyan");
    this.logger.debug("Creating new provider instance");

    const manager = SocketManager.get();
    this.subscriptions.push(manager.onConnect(this.onSocketConnected.bind(this)));
    this.subscriptions.push(manager.onDisconnect(this.onSocketDisconnected.bind(this)));
    this.connected = manager.isConnected();

    this.runbookId = runbookId;
    this.doc = doc;
    this.awareness = new awarenessProtocol.Awareness(this.doc);

    this.handleDocUpdate = this.handleDocUpdate.bind(this);
    this.handleAwarenessUpdate = this.handleAwarenessUpdate.bind(this);
    this.doc.on("update", this.handleDocUpdate);
    this.awareness.on("update", this.handleAwarenessUpdate);

    this.channel = manager.channel(`doc:${this.runbookId}`);
    this.subscriptions.push(this.channel.on("apply_update", this.handleIncomingUpdate.bind(this)));
    this.subscriptions.push(this.channel.on("awareness", this.handleIncomingAwareness.bind(this)));

    setTimeout(() => this.initSocket());
  }

  initSocket() {
    if (this.connected) {
      this.onSocketConnected();
    } else {
      this.logger.debug("Socket disconnected; starting in offline mode");
      this.startOffline();
    }
  }

  startOffline() {
    this.emit("synced");
  }

  handleIncomingUpdate(payload: Uint8Array) {
    Y.applyUpdate(this.doc, payload, this);
    this.emit("remote_update");
  }

  handleIncomingAwareness(payload: Uint8Array) {
    awarenessProtocol.applyAwarenessUpdate(this.awareness, payload, this);
  }

  async onSocketConnected() {
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

  onSocketDisconnected() {
    if (this.connected) {
      this.logger.warn("Socket disconnected");
      this.connected = false;
    }
  }

  handleDocUpdate(update: Uint8Array, origin: any) {
    if (origin === this || !this.channel) return;

    if (this.connected) {
      this.channel.push("client_update", update.buffer);
    }
  }

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

  async resync() {
    this.logger.info("Starting resync");

    try {
      const timerPromise = timeoutPromise(5000, false);
      const resyncPromise = this.doResync();
      const didResync = await Promise.race([timerPromise, resyncPromise]);
      if (!didResync) {
        this.logger.error("Resync timed out");
      }
    } catch (err) {
      this.logger.error("Failed to resync", err);
    }
    this.emit("synced");
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
    // disconnect from the server
    this.channel.leave();
    this.subscriptions.forEach((unsub) => unsub());
    // disconnect from the ydoc
    this.doc.off("update", this.handleDocUpdate);
    this.awareness.off("update", this.handleAwarenessUpdate);
    // shut down the event emitter
    this.clearListeners();
  }
}
