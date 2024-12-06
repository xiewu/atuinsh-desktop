import { Observable } from "lib0/observable";
import { Channel, Socket } from "phoenix";
import * as Y from "yjs";
import * as awarenessProtocol from "y-protocols/awareness";

import SocketManager from "../socket";
import Logger from "@/lib/logger";
const logger = new Logger("PhoenixProvider", "blue", "cyan");

type AwarenessData = { added: number[]; updated: number[]; removed: number[] };

export default class PhoenixProvider extends Observable<string> {
  private readonly logger: Logger;
  private socket!: Socket;
  private readonly runbookId: string;
  private readonly doc: Y.Doc;
  private readonly awareness: awarenessProtocol.Awareness;
  private channel?: Channel;
  private unregisterSocketChange: () => void;
  private handlers: string[] = [];

  constructor(runbookId: string, doc: Y.Doc) {
    super();
    this.logger = new Logger(`PhoenixProvider (${runbookId})`, "blue", "cyan");
    this.logger.debug("Creating new provider instance");

    const manager = SocketManager.get();
    this.unregisterSocketChange = manager.onSocketChange(
      this.handleNewSocket.bind(this),
    );

    this.socket = manager.getSocket();

    this.runbookId = runbookId;
    this.doc = doc;
    this.awareness = new awarenessProtocol.Awareness(this.doc);

    this.handleDocUpdate = this.handleDocUpdate.bind(this);
    this.handleAwarenessUpdate = this.handleAwarenessUpdate.bind(this);

    setTimeout(() => this.initSocket());
  }

  handleNewSocket(newSocket: Socket) {
    this.logger.debug("Switching out new socket...");
    this.shutdownSocket();
    this.socket = newSocket;
    setTimeout(() => this.initSocket());
  }

  initSocket() {
    this.handlers = [];
    this.channel = this.socket.channel(`doc:${this.runbookId}`);

    if (this.socket.isConnected()) {
      this.onSocketConnected();
    } else {
      const ref = this.socket.onOpen(this.onSocketConnected.bind(this));
      this.handlers.push(ref);
      this.logger.debug("Socket disconnected; starting in offline mode");
      this.startOffline();
    }
  }

  joinChannel() {
    if (!this.channel) {
      return Promise.reject(new Error("No channel to join"));
    }

    return new Promise((resolve, reject) => {
      this.channel!.join()
        .receive("ok", (resp: any) => {
          resolve(resp);
        })
        .receive("error", (resp: any) => {
          reject(resp);
        });
    });
  }

  startOffline() {
    this.emit("synced", []);
  }

  shutdownSocket() {
    this.socket.off(this.handlers);
  }

  async onSocketConnected() {
    this.logger.debug("Socket connected");
    try {
      await this.joinChannel();

      // Either this is the first connection, or we're reconnecting. Either way,
      // we need to resync with the remote document.
      this.doc.on("update", this.handleDocUpdate);
      this.awareness.on("update", this.handleAwarenessUpdate);
      this.setupChannelHandlers();

      this.logger.debug("Performing document resync");
      this.resync();
    } catch (err) {
      this.logger.error("Failed to join doc channel", err);
      this.logger.debug("Starting in offline mode");
      this.startOffline();
    }
  }

  handleDocUpdate(update: Uint8Array, origin: any) {
    if (origin === this || !this.channel) return;

    this.channel.push("client_update", update.buffer);
  }

  handleAwarenessUpdate(
    { added, updated, removed }: AwarenessData,
    origin: any,
  ) {
    this.logger.debug("Got awareness update from", origin);
    if (origin === this || !this.channel) return;

    const changedClients = added.concat(updated).concat(removed);
    this.channel.push(
      "client_awareness",
      awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients)
        .buffer,
    );
  }

  setupChannelHandlers() {
    if (!this.channel) return;

    this.channel.on("update", (payload) => {
      payload = new Uint8Array(payload);
      Y.applyUpdate(this.doc, payload, this);
      this.emit("remote_update", []);
    });

    this.channel.on("awareness", (payload) => {
      awarenessProtocol.applyAwarenessUpdate(
        this.awareness,
        payload.buffer,
        this,
      );
    });
  }

  async resync() {
    this.logger.debug("Resync complete");
    this.emit("synced", []);
    // this.logger.log("%cStarting resync", "color: orange");
    // const stateVector = Y.encodeStateVector(this.doc);
    // this.channel
    //   .push("sync_step_1", stateVector.buffer)
    //   .receive("ok", (serverVector) => {
    //     this.logger.log("%cReceived response 1", "color: orange");
    //     const diff = Y.encodeStateAsUpdate(this.doc, serverVector);
    //     this.channel
    //       .push("sync_step_2", diff.buffer)
    //       .receive("ok", (serverDiff) => {
    //         this.logger.log("%cReceived response 2", "color: orange");
    //         Y.applyUpdate(this.doc, serverDiff, this);
    //         this.emit("synced", []);
    //       });
    //   });
  }

  shutdown() {
    // disconnect from the ydoc
    this.doc.off("update", this.handleDocUpdate);
    this.awareness.off("update", this.handleAwarenessUpdate);
    this.unregisterSocketChange();
    this.shutdownSocket();
    // shut down the event emitter
    this.destroy();
    // disconnect from the server
    this.channel && this.channel.leave();
  }
}
