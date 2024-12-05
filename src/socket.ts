import { Channel, Socket } from "phoenix";
import { endpoint, getHubApiToken } from "./api/api";
import Logger from "@/lib/logger";
const logger = new Logger("Socket");

let socket: Socket;

export async function getSocket() {
  if (socket) return socket;

  const uri = new URL(endpoint());
  const host = uri.host;
  const protocol = uri.protocol === "https:" ? "wss" : "ws";

  const url = `${protocol}://${host}/sockets/doc`;
  const token = await getHubApiToken();

  socket = new Socket(url, {
    params: { token },
  });

  logger.debug("Connecting to the Hub...");
  socket.connect();

  return socket;
}

export function createChannel(socket: Socket, channelName: string) {
  return socket.channel(channelName, {});
}

export async function joinChannel(channel: Channel, timeout: number = 10000) {
  return new Promise<any>((res, rej) => {
    channel
      .join(timeout)
      .receive("ok", (resp: any) => {
        res(resp);
      })
      .receive("error", (resp: any) => {
        rej(resp);
      });
  });
}

export async function initSocket() {
  socket = await getSocket();
  return socket;
}
