import { MessageRef, Socket, Channel, Push } from "phoenix";
import { endpoint } from "./api/api";
import Logger from "@/lib/logger";
import Emittery from "emittery";
const logger = new Logger("Socket");
import { useStore } from "@/state/store";
import AtuinEnv from "./atuin_env";

export default class SocketManager extends Emittery {
  private static apiToken: string | null = null;
  private static instance: SocketManager;
  private handlers: MessageRef[] = [];
  private store: typeof useStore;
  private socket: Socket;

  static get() {
    if (!SocketManager.instance) {
      SocketManager.instance = new SocketManager(SocketManager.apiToken);
    }

    return SocketManager.instance;
  }

  static setApiToken(token: string | null) {
    SocketManager.apiToken = token;

    if (SocketManager.instance) {
      SocketManager.instance.putNewApiToken(token);
    }
  }

  constructor(apiToken: string | null) {
    super();
    this.store = useStore;
    this.socket = this.buildSocket(apiToken);
    this.setupHandlers();
    if (apiToken) {
      this.connect();
    } else {
      this.store.getState().setConnectedToHubSocket(false);
    }
  }

  public channel(topic: string, channelParams?: object) {
    return new WrappedChannel(this, topic, channelParams);
  }

  public onSocketChange(callback: (socket: Socket) => void) {
    return this.on("socketchange", callback);
  }

  public onConnect(callback: (socket: Socket) => void) {
    return this.on("connect", callback);
  }

  public onDisconnect(callback: (socket: Socket) => void) {
    return this.on("disconnect", callback);
  }

  public getSocket() {
    return this.socket;
  }

  public isConnected() {
    return this.socket.isConnected();
  }

  private putNewApiToken(token: string | null) {
    logger.info("Preparing new Socket with updated token");
    const newSocket = this.buildSocket(token);
    const previouslyConnected = this.socket.isConnected();
    this.socket.disconnect();
    this.cleanupHandlers();

    this.socket = newSocket;
    this.setupHandlers();

    if (token) {
      this.connect();
    } else if (previouslyConnected) {
      this.store.getState().setConnectedToHubSocket(false);
      this.emit("disconnect", this.socket);
    }
    this.emit("socketchange", this.socket);
  }

  private connect() {
    logger.debug(
      `Connecting to Atuin Hub with token: ${SocketManager.apiToken!.substring(0, 12)}...`,
    );
    this.socket.connect();
  }

  private buildSocket(apiToken: string | null) {
    const url = `${AtuinEnv.websocketProtocol}://${AtuinEnv.hubDomain}/sockets/doc`;

    return new Socket(url, {
      params: { token: apiToken },
    });
  }

  private setupHandlers() {
    this.handlers.push(
      this.socket.onOpen(() => {
        this.store.getState().setConnectedToHubSocket(true);
        this.emit("connect", this.socket);
      }),
    );
    this.handlers.push(
      this.socket.onClose(() => {
        this.store.getState().setConnectedToHubSocket(false);
        this.emit("disconnect", this.socket);
      }),
    );
  }

  private cleanupHandlers() {
    this.socket.off(this.handlers);
    this.handlers = [];
  }
}

export class WrappedChannel {
  private topic: string;
  private manager: SocketManager;
  private emitter: Emittery;
  private handlers: Map<string, { count: number; ref: number }> = new Map();
  private channelParams: object | undefined;
  private channel: Channel;

  constructor(manager: SocketManager, topic: string, channelParams?: object) {
    this.manager = manager;
    this.topic = topic;
    this.emitter = new Emittery();
    this.channelParams = channelParams;
    this.channel = this.manager.getSocket().channel(topic, channelParams);

    this.manager.onSocketChange(this.handleNewSocket.bind(this));
  }

  public join(timeout?: number) {
    return new Promise((resolve, reject) => {
      this.channel
        .join(timeout)
        .receive("ok", resolve)
        .receive("error", (resp) => {
          this.channel.leave();
          reject(resp);
        });
    });
  }

  public leave(timeout?: number) {
    const push = this.channel.leave(timeout);
    return new WrappedPush(push);
  }

  public on(event: string, callback: (response?: any) => void) {
    const unsub = this.emitter.on(event, callback);

    if (!this.handlers.has(event)) {
      const ref = this.channel.on(event, (response?: any) => {
        if (response && response instanceof ArrayBuffer) {
          this.emitter.emit(event, new Uint8Array(response));
        } else {
          this.emitter.emit(event, response);
        }
      });
      this.handlers.set(event, { count: 1, ref });
    } else {
      this.handlers.get(event)!.count++;
    }

    return () => {
      unsub();
      if (this.handlers.get(event)?.count == 1) {
        this.channel.off(event, this.handlers.get(event)!.ref);
        this.handlers.delete(event);
      } else {
        this.handlers.get(event)!.count--;
      }
    };
  }

  public push(event: string, payload: object, timeout?: number): WrappedPush {
    let data: any = payload;
    if (data instanceof Uint8Array) {
      data = data.buffer;
    }

    const push = this.channel.push(event, data, timeout);
    return new WrappedPush(push);
  }

  public get state() {
    return this.channel.state;
  }

  private handleNewSocket(socket: Socket) {
    const oldChannel = this.channel;
    this.channel = socket.channel(this.topic, this.channelParams);

    this.handlers.forEach(({ ref }, event) => {
      oldChannel.off(event, ref);
      const newRef = this.channel.on(event, (response?: any) => this.emitter.emit(event, response));
      this.handlers.get(event)!.ref = newRef;
    });
  }
}

export class WrappedPush {
  private push: Push;

  constructor(push: Push) {
    this.push = push;
  }

  receive<T = any>(): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.push
        .receive("ok", (data: T) => resolve(data))
        .receive("error", (error: any) => reject(error));
    });
  }

  receiveBin(): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      this.push
        .receive("ok", (data: ArrayBuffer) => resolve(new Uint8Array(data)))
        .receive("error", (error: any) => reject(error));
    });
  }
}
