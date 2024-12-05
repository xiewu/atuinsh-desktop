import { Observable } from "lib0/observable";
import { Channel, Socket } from "phoenix";
import * as Y from "yjs";
import * as awarenessProtocol from "y-protocols/awareness";

import { createChannel, joinChannel } from "../socket";
import Logger from "@/lib/logger";
const logger = new Logger("PhoenixProvider", "blue", "cyan");

type AwarenessData = { added: number[]; updated: number[]; removed: number[] };

export default class PhoenixProvider extends Observable<string> {
  private readonly socket: Socket;
  private readonly runbookId: string;
  private readonly doc: Y.Doc;
  private readonly awareness: awarenessProtocol.Awareness;
  private channel!: Channel;

  constructor(socket: Socket, runbookId: string, doc: Y.Doc) {
    super();

    logger.debug(`Creating provider for runbook ${runbookId}`);

    this.socket = socket;
    this.runbookId = runbookId;
    this.doc = doc;
    this.awareness = new awarenessProtocol.Awareness(this.doc);

    this.handleDocUpdate = this.handleDocUpdate.bind(this);
    this.handleAwarenessUpdate = this.handleAwarenessUpdate.bind(this);

    this.doc.on("update", this.handleDocUpdate);
    this.awareness.on("update", this.handleAwarenessUpdate);
  }

  async start() {
    try {
      logger.debug("Connecting...");
      await this.connect();
      logger.debug("Resyncing...");
      await this.resync();
    } catch (err) {
      logger.error("Error connecting to channel", err);
    }
  }

  handleDocUpdate(update: Uint8Array, origin: any) {
    logger.debug("Got document update from", origin, update);
    if (origin === this) return;

    this.channel.push("client_update", update.buffer);
  }

  handleAwarenessUpdate(
    { added, updated, removed }: AwarenessData,
    origin: any,
  ) {
    logger.debug("Got awareness update from", origin);
    if (origin === this) return;

    const changedClients = added.concat(updated).concat(removed);
    this.channel.push(
      "client_awareness",
      awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients)
        .buffer,
    );
  }

  async connect() {
    this.channel = createChannel(this.socket, `doc:${this.runbookId}`);
    if (this.socket.isConnected()) {
      try {
        await joinChannel(this.channel);
      } catch (err: any) {
        if (err.reason == "not found") {
          logger.warn(
            `Cound not connect to channel for runbook ${this.runbookId}; server runbook not found`,
          );
          this.channel.leave();
          this.emit("synced", []);
        }
      }

      this.channel.on("update", (payload) => {
        payload = new Uint8Array(payload);
        Y.applyUpdate(this.doc, payload, this);
      });

      this.channel.on("awareness", (payload) => {
        awarenessProtocol.applyAwarenessUpdate(
          this.awareness,
          payload.buffer,
          this,
        );
      });
    } else {
      throw new Error(
        "[PhoenixBridge] Cannot join channel because socket is not connected",
      );
    }
  }

  async resync() {
    logger.debug("Resync complete");
    this.emit("synced", []);
    // logger.log("%cStarting resync", "color: orange");
    // const stateVector = Y.encodeStateVector(this.doc);
    // this.channel
    //   .push("sync_step_1", stateVector.buffer)
    //   .receive("ok", (serverVector) => {
    //     logger.log("%cReceived response 1", "color: orange");
    //     const diff = Y.encodeStateAsUpdate(this.doc, serverVector);
    //     this.channel
    //       .push("sync_step_2", diff.buffer)
    //       .receive("ok", (serverDiff) => {
    //         logger.log("%cReceived response 2", "color: orange");
    //         Y.applyUpdate(this.doc, serverDiff, this);
    //         this.emit("synced", []);
    //       });
    //   });
  }

  shutdown() {
    // disconnect from the ydoc
    this.doc.off("update", this.handleDocUpdate);
    this.awareness.off("update", this.handleAwarenessUpdate);
    // shut down the event emitter
    this.destroy();
    // disconnect from the server
    this.channel && this.channel.leave();
  }
}
