import { Channel, Socket } from "phoenix";
import { endpoint, getHubApiToken } from "./api/api";

let socket: Socket;

async function getSocket() {
  if (socket) return socket;

  const uri = new URL(endpoint());
  const host = uri.host;
  const protocol = uri.protocol === "https:" ? "wss" : "ws";

  const url = `${protocol}://${host}/sockets/doc`;
  const token = await getHubApiToken();

  socket = new Socket(url, {
    params: { token },
  });

  socket.connect();

  return socket;
}

async function joinChannel(socket: Socket, channelName: string) {
  let channel = socket.channel(channelName, {});

  return new Promise<Channel>((res, rej) => {
    channel
      .join()
      .receive("ok", (resp: any) => {
        console.log("Joined successfully", resp);
        res(channel);
      })
      .receive("error", (resp: any) => {
        console.log("Unable to join", resp);
        rej(resp);
      });
  });
}

export async function initSocket() {
  socket = await getSocket();

  const id = "01934aa0-6d0b-7880-a5c0-9d82b5e3afee";
  let channel = await joinChannel(socket, `doc:${id}`);

  channel.push("get_content", {}).receive("ok", (resp: any) => {
    console.log(resp);
  });
}
