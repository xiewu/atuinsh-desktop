import { cn } from "@/lib/utils";
import { KVStore } from "@/state/kv";
import { Switch } from "@nextui-org/react";
import { ask } from "@tauri-apps/plugin-dialog";
import { relaunch } from "@tauri-apps/plugin-process";
import { useEffect, useState } from "react";

const GeneralSettings = () => {
  const [trackingOptIn, setTrackingOptIn] = useState(false);

  useEffect(() => {
    (async () => {
      let db = await KVStore.open_default();
      const tracking = await db.get("usage_tracking");
      setTrackingOptIn(tracking || false);
    })();
  }, []);

  return (
    <div>
      <Switch
        isSelected={trackingOptIn}
        onValueChange={(value) => {
          (async () => {
            let db = await KVStore.open_default();
            await db.set("usage_tracking", value);

            const restart = await ask(
              `
            Atuin needs to restart to apply your changes. This won't take long!
            `,
              {
                title: "Restart required",
                kind: "info",
                okLabel: "Restart",
                cancelLabel: "Later",
              },
            );

            if (restart) {
              await relaunch();
            }
          })();

          setTrackingOptIn(value);
        }}
        classNames={{
          base: cn(
            "inline-flex flex-row-reverse w-full max-w-full bg-content1 hover:bg-content2 items-center",
            "justify-between cursor-pointer rounded-lg gap-2 p-4 border-2 border-transparent",
            "data-[selected=true]:border-primary",
          ),
          wrapper: "p-0 h-4 overflow-visible",
          thumb: cn(
            "w-6 h-6 border-2 shadow-lg",
            "group-data-[hover=true]:border-primary",
            //selected
            "group-data-[selected=true]:ml-6",
            // pressed
            "group-data-[pressed=true]:w-7",
            "group-data-[selected]:group-data-[pressed]:ml-4",
          ),
        }}
      >
        <div className="flex flex-col gap-1">
          <p className="text-medium">Enable usage tracking</p>
          <p className="text-tiny text-default-400">
            Track usage and errors - data will be used to improve Atuin
          </p>
        </div>
      </Switch>
    </div>
  );
};

export default GeneralSettings;
