import { fetch } from "@tauri-apps/plugin-http";
import { onlineManager } from "@tanstack/react-query";
import { endpoint } from "../api/api";
import { useStore } from "@/state/store";

const CHECK_TIMEOUT = 10_000;

let checkTimer: number | null = null;
export async function trackOnlineStatus() {
  if (checkTimer) {
    clearTimeout(checkTimer);
    checkTimer = null;
  }

  try {
    const response = await fetch(`${endpoint()}/up`);
    if (response.status === 200) {
      onlineManager.setOnline(true);
      useStore.getState().setOnline(true);
    } else {
      onlineManager.setOnline(false);
      useStore.getState().setOnline(false);
    }
  } catch (err: any) {
    onlineManager.setOnline(false);
    useStore.getState().setOnline(false);
  }

  checkTimer = setTimeout(() => {
    trackOnlineStatus();
  }, CHECK_TIMEOUT);
}
