import { QueryClient } from "@tanstack/react-query";
import SocketManager, { WrappedChannel } from "./socket";
import Runbook from "./state/runbooks/runbook";

export default class ServerNotificationManager {
  static instance: ServerNotificationManager;
  private manager: SocketManager;
  private queryClient: QueryClient | undefined;
  private channel: WrappedChannel;

  static get() {
    if (!ServerNotificationManager.instance) {
      ServerNotificationManager.instance = new ServerNotificationManager();
    }

    return ServerNotificationManager.instance;
  }

  constructor() {
    this.manager = SocketManager.get();
    this.channel = this.manager.channel("notifications");
  }

  public setQueryClient(queryClient: QueryClient) {
    this.queryClient = queryClient;

    this.manager.onConnect(async () => {
      if (this.channel.state == "closed") {
        await this.channel.join();
      }

      const rbs = await Runbook.allInAllWorkspaces();
      const ids = rbs.map((r) => r.id);
      // Subscribe is idempotent, so we can just call it with all the runbook IDs
      this.channel.push("subscribe", { ids: ids });
      this.channel.on("runbook_updated", (params) => {
        this.queryClient!.invalidateQueries({ queryKey: ["remote_runbook", params.id] });
      });
      this.channel.on("runbook_deleted", (params) => {
        this.queryClient!.invalidateQueries({ queryKey: ["remote_runbook", params.id] });
      });
    });
  }

  public subscribe(runbookId: string) {
    this.channel.push("subscribe", { ids: [runbookId] });
  }
}
