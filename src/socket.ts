import { MessageRef, Socket } from "phoenix";
import { endpoint } from "./api/api";
import Logger from "@/lib/logger";
import { Observable } from "lib0/observable.js";
const logger = new Logger("Socket");

export default class SocketManager extends Observable<string> {
  private static apiToken: string | null = null;
  private static instance: SocketManager;
  private handlers: MessageRef[] = [];

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
    this.socket = this.buildSocket(apiToken);
    this.setupHandlers();
    if (apiToken) {
      this.connect();
    }
  }

  public onSocketChange(callback: (socket: Socket) => void) {
    this.on("socketchange", callback);
    return () => this.off("socketchange", callback);
  }

  public onConnect(callback: () => void) {
    this.on("connect", callback);
    return () => this.off("connect", callback);
  }

  public onDisconnect(callback: () => void) {
    this.on("disconnect", callback);
    return () => this.off("disconnect", callback);
  }

  public channel(channelName: string, channelParams?: object) {
    return this.socket.channel(channelName, channelParams || {});
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
    this.socket.disconnect();
    this.cleanupHandlers();

    this.socket = newSocket;
    this.setupHandlers();

    if (token) {
      this.connect();
    }
    this.emit("socketchange", [newSocket]);
  }

  private connect() {
    logger.debug(
      `Connecting to Atuin Hub with token: ${SocketManager.apiToken!.substring(0, 12)}...`,
    );
    this.socket.connect();
  }

  private buildSocket(apiToken: string | null) {
    const uri = new URL(endpoint());
    const host = uri.host;
    const protocol = uri.protocol === "https:" ? "wss" : "ws";
    const url = `${protocol}://${host}/sockets/doc`;

    return new Socket(url, {
      params: { token: apiToken },
    });
  }

  private setupHandlers() {
    this.handlers.push(this.socket.onOpen(() => this.emit("connect", [])));
    this.handlers.push(this.socket.onClose(() => this.emit("disconnect", [])));
  }

  private cleanupHandlers() {
    this.socket.off(this.handlers);
    this.handlers = [];
  }
}
