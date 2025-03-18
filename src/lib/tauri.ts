/// This is a hook. Given a function and an event name, it will
/// listen for the event and call the function when it is emitted.
/// It will also handle automatically disposing of the listener
/// when the component dismounts.

import React from "react";
import { EventCallback, listen, UnlistenFn } from "@tauri-apps/api/event";

const useTauriEvent = (eventName: string, func: EventCallback<any>): void => {
  const funcRef = React.useRef<EventCallback<any>>(func);
  const unlistenRef = React.useRef<UnlistenFn | undefined>(undefined);

  // Update the ref whenever func changes
  React.useEffect(() => {
    funcRef.current = func;
  }, [func]);

  React.useEffect(() => {
    const startListen = async () => {
      if (unlistenRef.current) {
        await unlistenRef.current();
        unlistenRef.current = undefined;
      }

      unlistenRef.current = await listen(eventName, funcRef.current);
    };

    const stopListen = async () => {
      if (unlistenRef.current) {
        await unlistenRef.current();
        unlistenRef.current = undefined;
      }
    };

    startListen();

    return () => {
      stopListen();
    };
  }, [eventName]); // Only re-run if eventName changes
};

export { useTauriEvent };
