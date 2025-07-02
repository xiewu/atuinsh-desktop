// handle calls to the backend to make ssh happen ✨

import { invoke } from "@tauri-apps/api/core";
import SSHBus from "@/lib/buses/ssh";
import { addToast } from "@heroui/react";

export async function sshConnect(userHost: string): Promise<void> {
  let username: string | undefined;
  let host: string;
  
  // Handle both "user@host" and just "host" formats
  if (userHost.includes("@")) {
    [username, host] = userHost.split("@");
  } else {
    // No username specified, let SSH config determine it
    username = undefined;
    host = userHost;
  }
  
  try {
    // Set status to idle while connecting
    SSHBus.get().updateConnectionStatus(userHost, "idle");
    
    await invoke("ssh_connect", { username, host });
    
    // If successful, update the status
    SSHBus.get().updateConnectionStatus(userHost, "success");
    return Promise.resolve();
  } catch (error) {
    // If there's an error, update the status
    SSHBus.get().updateConnectionStatus(userHost, "error");
    console.error(error);

      addToast({
        title: "SSH connection failed",
      description: `Failed to connect to ${userHost}.`,
      color: "danger",
    });

    return Promise.reject(error);
  }
}
