import * as Sentry from "@sentry/react";
import posthog from "posthog-js";

import { KVStore } from "./state/kv";

export const init_tracking = async () => {
  // don't need to spam sentry with my dumbass mistakes
  //if (import.meta.env.MODE === "development") return;

  let db = await KVStore.open_default();
  let track = await db.get("usage_tracking");

  if (track) {
    console.log("User opted-in to tracking");

    Sentry.init({
      dsn: "https://ac8c00adf29c329694a0b105e1981ca3@o4507730431442944.ingest.us.sentry.io/4507741947232256",
    });

    posthog.init("phc_EOWZsUljQ4HdvlGgoVAhhjktfDDDqYf4lKxzZ1wDkJv", {
      api_host: "https://us.i.posthog.com",
      person_profiles: "identified_only", // or 'always' to create profiles for anonymous users as well
      autocapture: false,
    });
  } else {
    console.log("User did not opt-in to tracking");
  }
};

export default function track_event(event: string, properties: any) {
  let res = posthog.capture(event, properties || {});
  console.log(res);
}
