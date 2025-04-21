// handle calls to the backend to make ssh happen ✨

import { invoke } from "@tauri-apps/api/core";
import SSHBus from "@/lib/workflow/ssh_bus";

export async function sshConnect(userHost: string): Promise<void> {
  let [username, host] = userHost.split("@");
  
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
    return Promise.reject(error);
  }
}
