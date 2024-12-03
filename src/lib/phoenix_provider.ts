import { Observable } from "lib0/observable";
import { Channel, Socket } from "phoenix";
import * as Y from "yjs";
import * as awarenessProtocol from "y-protocols/awareness";

import { joinChannel } from "../socket";

type AwarenessData = { added: number[]; updated: number[]; removed: number[] };

export default class PhoenixProvider extends Observable<string> {
  private readonly socket: Socket;
  private readonly runbookId: string;
  private readonly doc: Y.Doc;
  private readonly awareness: awarenessProtocol.Awareness;
  private channel!: Channel;

  constructor(socket: Socket, runbookId: string, doc: Y.Doc) {
    super();

    this.socket = socket;
    this.runbookId = runbookId;
    this.doc = doc;
    this.awareness = new awarenessProtocol.Awareness(this.doc);

    this.doc.on("update", (update: Uint8Array, origin: any) => {
      this.handleDocUpdate(update, origin);
    });

    // this.awareness.on("update", ({ added, updated, removed }, origin: any) => {
    //   this.handleAwarenessUpdate({ added, updated, removed }, origin);
    // });

    this.connect()
      .then(() => {
        this.resync();
      })
      .catch((err) => {
        console.error("[PhoenixProvider] Error connecting to channel", err);
      });
  }

  handleDocUpdate(update: Uint8Array, origin: any) {
    if (origin === this) return;

    this.channel.push("client_update", update.buffer);
  }

  handleAwarenessUpdate(
    { added, updated, removed }: AwarenessData,
    origin: any,
  ) {
    if (origin === this) return;

    const changedClients = added.concat(updated).concat(removed);
    this.channel.push(
      "client_awareness",
      awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients)
        .buffer,
    );
  }

  async connect() {
    if (this.socket.isConnected()) {
      const channel = await joinChannel(this.socket, `doc:${this.runbookId}`);
      this.channel = channel;

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
    const stateVector = Y.encodeStateVector(this.doc);
    this.channel
      .push("sync_step_1", stateVector.buffer)
      .receive("ok", (serverVector) => {
        const diff = Y.encodeStateAsUpdate(this.doc, serverVector);
        this.channel
          .push("sync_step_2", diff.buffer)
          .receive("ok", (serverDiff) => {
            Y.applyUpdate(this.doc, serverDiff, this);
            this.emit("synced", []);
          });
      });
  }
}
