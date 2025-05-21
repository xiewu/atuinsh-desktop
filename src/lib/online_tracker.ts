import { fetch } from "@tauri-apps/plugin-http";
import { onlineManager } from "@tanstack/react-query";
import { endpoint } from "../api/api";
import { useStore } from "@/state/store";
import { clearTimeout, setTimeout } from "worker-timers";
import { Some, None } from "./utils";

const CHECK_TIMEOUT = 15_000;

let checkTimer: number | null = null;
let online: boolean | null = null;

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
    let minVersion = response.headers.get("atuin-min-desktop-version");
    let currentMinVersion = useStore.getState().minimumVersion;

    if (minVersion && (currentMinVersion.isNone() || currentMinVersion.unwrap() !== minVersion)) {
      useStore.getState().setMinimumVersion(Some(minVersion));
    } else if (currentMinVersion.isSome() && !minVersion) {
      useStore.getState().setMinimumVersion(None);
    }

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
