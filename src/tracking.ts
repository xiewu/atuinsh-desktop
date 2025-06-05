import { invoke } from "@tauri-apps/api/core";
import { KVStore } from "./state/kv";
import AtuinEnv from "./atuin_env";
import { useStore } from "./state/store";
import * as Sentry from "@sentry/react";
import posthog from "posthog-js";

let platformInfo: string | null = null;

export const init_tracking = async () => {
  // don't need to spam sentry with my dumbass mistakes
  if (AtuinEnv.isDev) return;

  let db = await KVStore.open_default();
  let track = await db.get<boolean>("usage_tracking");
  let onboarding_complete = await db.get<boolean>("onboarding_complete");
  let system_id = await db.systemId();

  // Get platform info once and cache it
  try {
    platformInfo = await invoke<string>("get_platform_info");
  } catch (e) {
    console.warn("Failed to get platform info:", e);
    platformInfo = "unknown";
  }

  // fixing my fuck up!
  // 1. if tracking is null, BUT we have finished onboarding, we should set it to true
  // 2. if the user had opted out during onboarding, then we would have written false to the kv
  if (track === null && onboarding_complete) {
    track = true;
    await db.set("usage_tracking", true);
  }

  // In this case, the user has not yet finished the onboarding flow!
  // We should not track them as they might be about to opt-out
  // init_tracking is normally called asap, but it is also called from the onboarding
  if (track === null) {
    console.log("User has not finished onboarding");
    return;
  }

  if (track) {
    let appVersion: string | null = null;

    try {
      appVersion = await invoke<string>("get_app_version");
    } catch (e) {
      console.error("Failed to get app version:", e);
    }

    Sentry.init({
      dsn: "https://ac8c00adf29c329694a0b105e1981ca3@o4507730431442944.ingest.us.sentry.io/4507741947232256",
      environment: "production",
      release: appVersion || "unknown",
    });

    posthog.init("phc_EOWZsUljQ4HdvlGgoVAhhjktfDDDqYf4lKxzZ1wDkJv", {
      api_host: "https://us.i.posthog.com",
      person_profiles: "identified_only", // or 'always' to create profiles for anonymous users as well
      autocapture: false,
    });

    useStore.subscribe(
      (store) => store.user,
      (user, lastUser) => {
        if (user && user.is(lastUser)) return;

        const isLoggedIn = user && user.isLoggedIn();
        const wasLoggedIn = lastUser && lastUser.isLoggedIn();

        if (isLoggedIn && !wasLoggedIn) {
          // User just logged in
          track_event("user.login");

          // Only set user context for Sentry (error tracking)
          Sentry.setUser({
            username: user.username,
            email: user.email || "",
          });
        } else if (!isLoggedIn && wasLoggedIn) {
          // User just logged out
          track_event("user.logout");

          Sentry.setUser(null);
        }
      },
    );

    posthog.identify(system_id);

    // Track app start
    track_event("app.start");

    console.log("User opted in to tracking");
  } else {
    console.log("User opted out of tracking");
  }
};

export default async function track_event(event: string, properties: any = {}) {
  if (AtuinEnv.isDev) {
    console.log(
      `[dev] track_event: ${event} -> ${JSON.stringify({ ...properties, platform: platformInfo })}`,
    );
    return;
  }

  let appVersion: string | null = null;

  try {
    appVersion = await invoke<string>("get_app_version");
  } catch (e) {
    console.error("Failed to get app version:", e);
  }

  // Always include platform info in every event
  const eventProperties = {
    ...properties,
    platform: platformInfo,
    version: appVersion,
  };

  const { default: posthog } = await import("posthog-js");
  posthog.capture(event, eventProperties);
}
