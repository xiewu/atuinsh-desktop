import * as Sentry from "@sentry/react";
import posthog from "posthog-js";
import { invoke } from "@tauri-apps/api/core";

import { KVStore } from "./state/kv";
import AtuinEnv from "./atuin_env";
import { useStore } from "./state/store";

export const init_tracking = async () => {
  // don't need to spam sentry with my dumbass mistakes
  if (AtuinEnv.isDev) return;


  let db = await KVStore.open_default();
  let track = await db.get<boolean>("usage_tracking");
  let system_id = await db.systemId();


  // Default to true, opt-out
  if (track === null) {
    track = true;
    await db.set("usage_tracking", true);
  }

  if (track) {
    const appVersion = await invoke<string>("get_app_version");

    Sentry.init({
      dsn: "https://ac8c00adf29c329694a0b105e1981ca3@o4507730431442944.ingest.us.sentry.io/4507741947232256",
      environment: "production",
      release: appVersion,
    });

    posthog.init("phc_EOWZsUljQ4HdvlGgoVAhhjktfDDDqYf4lKxzZ1wDkJv", {
      api_host: "https://us.i.posthog.com",
      person_profiles: "identified_only", // or 'always' to create profiles for anonymous users as well
      autocapture: false,
    });

    useStore.subscribe(store => store.user, (user, lastUser) => {
      if (!user || user.is(lastUser)) return;
      if (user.isLoggedIn()) {
        Sentry.setUser({
          username: user.username,
          email: user.email || "",
        });
      } else {
        Sentry.setUser(null);
      }
    })

    posthog.identify(system_id);
  } else {
    console.log("User opted out of tracking");
  }
};

export default function track_event(event: string, properties: any = {}) {
  if (AtuinEnv.isDev) {
    console.log(`[dev] track_event: ${event} -> ${JSON.stringify(properties)}`);
    return;
  }

  posthog.capture(event, properties || {});
}
