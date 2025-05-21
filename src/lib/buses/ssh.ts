import Emittery from "emittery";

// Define possible connection states
export type ConnectionStatus = "idle" | "success" | "error";

/**
 * A system for using events to communicate SSH connection state changes
 * Allows components to subscribe to connection status changes
 */
export default class SSHBus extends Emittery {
  static instance: SSHBus;

  // Map of connection strings to their status
  private connectionStatuses: Map<string, ConnectionStatus> = new Map();

  static get() {
    if (!SSHBus.instance) {
      SSHBus.instance = new SSHBus();
    }
    return SSHBus.instance;
  }

  constructor() {
    super();
  }

  /**
   * Get the current status of a connection
   *
   * @param connectionString - The connection string (user@host) to check
   * @returns The current status or "idle" if not found
   */
  getConnectionStatus(connectionString: string): ConnectionStatus {
    return this.connectionStatuses.get(connectionString) || "idle";
  }

  /**
   * Update the status of a connection and emit an event
   *
   * @param connectionString - The connection string (user@host) to update
   * @param status - The new status
   */
  updateConnectionStatus(connectionString: string, status: ConnectionStatus) {
    this.connectionStatuses.set(connectionString, status);
    this.emit(`connection_status_changed:${connectionString}`, status);
    this.emit("any_connection_status_changed", { connectionString, status });
  }

  /**
   * Subscribe to changes of a specific connection
   *
   * @param connectionString - The connection string (user@host) to subscribe to
   * @param callback - The callback to call when the status changes
   * @returns A function to unsubscribe
   */
  subscribeConnectionStatus(
    connectionString: string,
    callback: (status: ConnectionStatus) => void,
  ): () => void {
    return this.on(`connection_status_changed:${connectionString}`, callback);
  }

  /**
   * Unsubscribe from changes of a specific connection
   *
   * @param connectionString - The connection string to unsubscribe from
   * @param callback - The callback to unsubscribe
   */
  unsubscribeConnectionStatus(
    connectionString: string,
    callback: (status: ConnectionStatus) => void,
  ) {
    this.off(`connection_status_changed:${connectionString}`, callback);
  }

  /**
   * Subscribe to changes of any connection
   *
   * @param callback - The callback to call when any connection status changes
   * @returns A function to unsubscribe
   */
  subscribeAnyConnectionStatus(
    callback: (data: { connectionString: string; status: ConnectionStatus }) => void,
  ): () => void {
    return this.on("any_connection_status_changed", callback);
  }

  /**
   * Unsubscribe from changes of any connection
   *
   * @param callback - The callback to unsubscribe
   */
  unsubscribeAnyConnectionStatus(
    callback: (data: { connectionString: string; status: ConnectionStatus }) => void,
  ) {
    this.off("any_connection_status_changed", callback);
  }

  /**
   * Reset the status of a connection to idle
   *
   * @param connectionString - The connection string to reset
   */
  resetConnectionStatus(connectionString: string) {
    this.updateConnectionStatus(connectionString, "idle");
  }

  /**
   * Clear all stored connection statuses
   */
  clearAllConnectionStatuses() {
    this.connectionStatuses.clear();
    this.emit("all_connections_cleared");
  }
}
