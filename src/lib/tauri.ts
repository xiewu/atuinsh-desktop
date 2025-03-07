/// This is a hook. Given a function and an event name, it will
/// listen for the event and call the function when it is emitted.
/// It will also handle automatically disposing of the listener
/// when the component dismounts.

import React from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

const useTauriEvent = (eventName: string, func: () => Promise<void>) => {
  let ref = React.useRef<UnlistenFn>(undefined);

  React.useEffect(() => {
    (async () => {
      if (ref.current) ref.current();

      ref.current = await listen(eventName, func);
    })();

    return () => {
      if (ref.current) ref.current();
    };
  }, [eventName, func]);
};

export { useTauriEvent };
