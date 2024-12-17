import SocketManager from "@/socket";
import { useStore } from "@/state/store";
import Runbook from "@/state/runbooks/runbook";
import Logger from "./logger";

type Store = typeof useStore;

export default class CollaborationManager {
  private readonly logger: Logger = new Logger(
    "CollaborationManager",
    "#ff33cc",
    "#ff6677",
  );
  private socketManager: SocketManager;
  private store: Store;
  private connected: boolean;
  private handlers: Function[] = [];
  // @ts-ignore
  private currentRunbookId: string | null = null;
  private runbooks: Runbook[] = [];

  constructor(socketManager: SocketManager, store: Store) {
    this.socketManager = socketManager;
    this.store = store;
    this.connected = this.socketManager.isConnected();

    this.handleConnect = this.handleConnect.bind(this);
    this.handleDisconnect = this.handleDisconnect.bind(this);
    this.handleRunbookChange = this.handleRunbookChange.bind(this);
    this.handleRunbooksChange = this.handleRunbooksChange.bind(this);

    this.handlers.push(this.socketManager.onConnect(this.handleConnect));
    this.handlers.push(this.socketManager.onDisconnect(this.handleDisconnect));
    this.handlers.push(
      this.store.subscribe(
        (state) => state.currentRunbookId,
        this.handleRunbookChange,
        { fireImmediately: true },
      ),
    );
    this.handlers.push(
      this.store.subscribe(
        (state) => state.runbooks,
        this.handleRunbooksChange,
        { fireImmediately: true },
      ),
    );

    if (this.connected) {
      this.logger.debug("Starting resync process");
      this.startSyncProcess();
    }
  }

  private startSyncProcess() {
    // TODO:
    // For each runbook, create a synchronizer.
    // Unless the runbook is the active runbok, ask the synchronizer to check with
    // the server to see if the document has changed.
    // Schedule a check every so often (or maybe subscribe to the lobby channel
    // for notifications that runbooks have updated on the server).
    //
    // TODO: how do we update the content field when a runbook isn't currently loaded
    // into blocknote?
  }

  private handleConnect() {
    this.logger.debug("Connection to server established");
    this.connected = true;
  }

  private handleDisconnect() {
    this.logger.debug("Connection to server lost");
    this.connected = false;
  }

  private handleRunbookChange(
    runbook: string | null,
    _previousRunbook: string | null,
  ) {
    this.currentRunbookId = runbook;
  }

  private handleRunbooksChange(runbooks: Runbook[]) {
    const oldRbIds = new Set(this.runbooks.map((rb) => rb.id));
    const newRbIds = new Set(runbooks.map((rb) => rb.id));

    const added = runbooks.filter((rb) => !oldRbIds.has(rb.id));
    const removed = this.runbooks.filter((rb) => !newRbIds.has(rb.id));

    // TODO: remove old syncs, add new ones

    if (added.length > 0 || removed.length > 0) {
      this.logger.debug(
        `Runbooks updated with ${added.length} additions and ${removed.length} removals`,
      );
    }

    this.runbooks = runbooks;
  }

  public destroy() {
    this.handlers.forEach((unsub) => unsub());
  }
}
