import SocketManager, { WrappedChannel } from "./socket";
import Runbook from "./state/runbooks/runbook";
import Emittery from "emittery";

type ServerNotification = {
  id: string;
};

/**
 * Connects to the Hub via websocket and requests notifications for changes
 * to subscribed runbooks.
 *
 * @emits `"runbook_updated", runbookId`
 * @emits `"runbook_deleted", runbookId`
 * @emits `"collab_invited", collabId`
 * @emits `"collab_accepted", collabId`
 * @emits `"collab_deleted", collabId`
 */
export default class ServerNotificationManager extends Emittery {
  static instance: ServerNotificationManager;
  private manager: SocketManager;
  private channel: WrappedChannel;

  static get() {
    if (!ServerNotificationManager.instance) {
      ServerNotificationManager.instance = new ServerNotificationManager();
    }

    return ServerNotificationManager.instance;
  }

  constructor() {
    super();
    this.manager = SocketManager.get();
    this.channel = this.manager.channel("notifications");
    this.manager.onConnect(() => {
      this.startNotifications();
    });
  }

  public async startNotifications() {
    if (this.channel.state == "closed") {
      await this.channel.join();
    }

    // Subscribe is idempotent on the server, so we can just call it with all the runbook IDs
    const ids = await Runbook.allIdsInAllWorkspaces();
    this.channel.push("subscribe", { ids: ids });
    this.channel.on("runbook_updated", (params: ServerNotification) => {
      this.emit("runbook_updated", params.id);
    });
    this.channel.on("runbook_deleted", (params: ServerNotification) => {
      this.emit("runbook_deleted", params.id);
    });
    this.channel.on("collab_invited", (params: ServerNotification) => {
      this.emit("collab_invited", params.id);
    });
    this.channel.on("collab_accepted", (params: ServerNotification) => {
      this.emit("collab_accepted", params.id);
    });
    this.channel.on("collab_deleted", (params: ServerNotification) => {
      this.emit("collab_deleted", params.id);
    });
  }

  /**
   * Subscribe to notifications for a specific runbook. The server ignores
   * duplicate subscriptions.
   * @param runbookId The ID of the runbook to subscribe to
   */
  public subscribe(runbookId: string) {
    this.channel.push("subscribe", { ids: [runbookId] });
  }
}
