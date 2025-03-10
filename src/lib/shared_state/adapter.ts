import * as jsondiffpatch from "jsondiffpatch";
import SocketManager, { WrappedChannel } from "@/socket";
import Emittery, { UnsubscribeFunction } from "emittery";
import { autobind } from "../decorators";
import Logger from "../logger";
import { Version, Event, ServerUpdate, ChangeRef, SharableState } from "./types";

type ResyncRequest = {
  last_known_version: Version;
};

type ResyncPayload<T> = {
  version: Version;
  data: T;
};

export type ServerUpdatePayload = {
  version: Version;
  delta: jsondiffpatch.Delta;
  change_ref: ChangeRef;
};

/**
 * An adapter for managing a shared state. Responsible for receiving updates from
 * some endpoint.
 *
 * @param T - The type of the shared state.
 */
export interface SharedStateAdapter<T extends SharableState> {
  init(): Promise<void>;
  subscribe(callback: (payload: ServerUpdate) => void): UnsubscribeFunction;
  resync(last_known_version: Version): Promise<ResyncPayload<T>>;
  destroy(): void;
}

const socketManager = SocketManager.get();

/**
 * An adapter for managing a shared state document that uses Phoenix channels to communicate
 * with Atuin Hub.
 *
 * @param T - The type of the shared state.
 */
export class AtuinSharedStateAdapter<T extends SharableState> implements SharedStateAdapter<T> {
  private channel: WrappedChannel;
  private emitter: Emittery = new Emittery();
  private logger: Logger;
  private unsub: UnsubscribeFunction | null = null;

  constructor(stateId: string) {
    this.channel = socketManager.channel(`shared-state:${stateId}`);
    this.logger = new Logger(`PhoenixSharedStateAdapter: ${stateId}`);
  }

  public async init() {
    try {
      await this.channel.join();
    } catch (err) {
      this.logger.error("Failed to join channel:", err);
      throw err;
    }

    this.unsub = this.channel.on(Event.UPDATE, this.handleUpdate);
  }

  public subscribe(callback: (payload: ServerUpdate) => void): UnsubscribeFunction {
    return this.emitter.on(Event.UPDATE, callback);
  }

  public resync(last_known_version: Version): Promise<ResyncPayload<T>> {
    return this.channel
      .push<ResyncRequest>(Event.RESYNC_REQ, { last_known_version })
      .receive<ResyncPayload<T>>();
  }

  public destroy() {
    this.logger.debug("Shutting down");
    this.unsub?.();
    this.emitter.clearListeners();
  }

  @autobind
  private handleUpdate(payload: ServerUpdatePayload) {
    this.emitter.emit(Event.UPDATE, payload);
  }
}
