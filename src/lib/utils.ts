import { invoke } from "@tauri-apps/api/core";
import type { ClassValue } from "clsx";

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
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
    return `${Math.round(ms)}ms`;
  }

  const seconds = Math.floor(ms / 1000);
  const milliseconds = ms % 1000;

  // For sub-2-minute durations, we display seconds with optional milliseconds
  // We floor the milliseconds first to avoid floating point imprecision
  // causing extra decimal places
  if (seconds < 120) {
    return `${seconds}${milliseconds ? `.${Math.floor(milliseconds).toString().padStart(3, "0")}` : ""}s`;
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

/**
 * Sets state to true after a timeout, but resets the timer if the reset
 * function is called.

 * Returns a tuple of the debounced state, a function to reset the debounce,
 * and a function to clear the debounced state without restarting the timer.
 *
 * @param timeout How long to wait before setting the state to true
 */
export function useDebounce(timeout: number): [boolean, () => void, () => void] {
  const ref = useRef<number | null>(null);
  const [debounced, setDebouced] = useState<boolean>(false);

  function resetDebounce() {
    setDebouced(false);
    if (ref.current) {
      clearTimeout(ref.current);
    }
    ref.current = setTimeout(() => {
      setDebouced(true);
    }, timeout);
  }

  function clearDebouce() {
    setDebouced(false);
    if (ref.current) {
      clearTimeout(ref.current);
    }
  }

  return [debounced, resetDebounce, clearDebouce];
}

/**
 * Stores the value in a ref and updates it when the value changes. Useful for
 * ensuring that a value is up-to-date in an async callback.
 */
export function useMemory<T>(value: T): React.MutableRefObject<T> {
  const ref = useRef<T>(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref;
}
