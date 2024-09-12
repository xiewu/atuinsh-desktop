import { invoke } from "@tauri-apps/api/core";
import type { ClassValue } from "clsx";

import clsx from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const COMMON_UNITS = ["small", "medium", "large"];

/**
 * We need to extend the tailwind merge to include NextUI's custom classes.
 *
 * So we can use classes like `text-small` or `text-default-500` and override them.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      opacity: ["disabled"],
      spacing: ["divider"],
      borderWidth: COMMON_UNITS,
      borderRadius: COMMON_UNITS,
    },
    classGroups: {
      shadow: [{ shadow: COMMON_UNITS }],
      "font-size": [{ text: ["tiny", ...COMMON_UNITS] }],
      "bg-image": ["bg-stripe-gradient"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// edge still uses the old one
export function getWeekInfo() {
  let locale = new Intl.Locale(navigator.language);

  // @ts-ignore
  if (locale.getWeekInfo) {
    // @ts-ignore
    return locale.getWeekInfo();
    // @ts-ignore
  } else if (locale.weekInfo) {
    // @ts-ignore
    return locale.weekInfo;
  }

  throw new Error("Could not fetch week info via new or old api");
}

export function formatBytes(bytes: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    style: "unit",
    unit: "byte",
    unitDisplay: "narrow",
  }).format(bytes);
}

export function formatDuration(ms: number) {
  if (ms < 2000) {
    return `${ms}ms`;
  }

  const seconds = Math.floor(ms / 1000);
  const milliseconds = ms % 1000;

  if (seconds < 120) {
    return `${seconds}${milliseconds ? `.${milliseconds.toString().padStart(3, "0")}` : ""}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours < 24) {
    return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  return `${days}d ${remainingHours}h ${remainingMinutes}m ${remainingSeconds}s`;
}

export async function installAtuinCLI() {
  console.log("Installing CLI...");
  await invoke("install_cli");

  console.log("Setting up plugin...");
  await invoke("setup_cli");
}
