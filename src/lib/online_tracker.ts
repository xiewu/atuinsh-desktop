import { fetch } from "@tauri-apps/plugin-http";
import { onlineManager } from "@tanstack/react-query";
import { endpoint } from "../api/api";
import { useStore } from "@/state/store";

const CHECK_TIMEOUT = 10_000;

let checkTimer: number | null = null;
let online = false;

function setOnline(newOnline: boolean) {
  if (newOnline === online) return;

  onlineManager.setOnline(newOnline);
  useStore.getState().setOnline(newOnline);
}

export async function trackOnlineStatus() {
  if (checkTimer) {
    clearTimeout(checkTimer);
    checkTimer = null;
  }

  try {
    const response = await fetch(`${endpoint()}/up`);
    if (response.status === 200) {
      setOnline(true);
    } else {
      setOnline(false);
    }
  } catch (err: any) {
    setOnline(false);
  }

  checkTimer = setTimeout(() => {
    trackOnlineStatus();
  }, CHECK_TIMEOUT);
}
