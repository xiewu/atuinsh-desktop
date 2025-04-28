// [MKT] NextUI seems to have added a logging function that depends on checking
// for the `NODE_ENV` environment variable in the `process` object. It throws
// an exception when trying to access the global `process` object, so this
// shims out NODE_ENV with the Tauri env.
(window as any).process = (window as any).process || {
  env: {
    NODE_ENV: import.meta.env.MODE,
  },
};

// import sentry before anything else
import { init_tracking } from "./tracking";

import { event } from "@tauri-apps/api";
import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import { createHashRouter, RouterProvider } from "react-router-dom";
import { HeroUIProvider, ToastProvider } from "@heroui/react";
import { QueryClientProvider } from "@tanstack/react-query";
import "./styles.css";

import Root from "@/routes/root/Root";
import Home from "@/routes/home/Home";
import Runbooks from "@/routes/runbooks/Runbooks";
import History from "@/routes/history/History";
import Stats from "@/routes/stats/Stats";
import * as api from "./api/api";
import SocketManager from "./socket";
import SyncManager from "./lib/sync/sync_manager";
import { useStore } from "@/state/store";
import ServerNotificationManager from "./server_notification_manager";
import { trackOnlineStatus } from "./lib/online_tracker";
import AtuinEnv from "./atuin_env";
import { setupColorModes } from "./lib/color_modes";
import { setupServerEvents } from "./lib/server_events";
import SettingsPanel from "./components/Settings/Settings";
import { invoke } from "@tauri-apps/api/core";
import debounce from "lodash.debounce";
import { getGlobalOptions } from "./lib/global_options";
import Workspace from "./state/runbooks/workspace";
import { SharedStateManager } from "./lib/shared_state/manager";
import { AtuinSharedStateAdapter } from "./lib/shared_state/adapter";
import { startup as startupOperationProcessor } from "./state/runbooks/operation_processor";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

(async () => {
  try {
    const token = await api.getHubApiToken();
    SocketManager.setApiToken(token);
  } catch (_err) {
    console.warn("Not able to fetch Hub API token for socket manager");
  }
})();

// If the user has opted in, we will setup sentry/posthog
init_tracking();

const socketManager = SocketManager.get();
const notificationManager = ServerNotificationManager.get();
const syncManager = SyncManager.get(useStore);
const queryClient = useStore.getState().queryClient;

event.listen("tauri://blur", () => {
  useStore.getState().setFocused(false);
});

event.listen("tauri://focus", () => {
  useStore.getState().setFocused(true);
});

setupServerEvents(useStore, notificationManager, syncManager);
setupColorModes(useStore);

trackOnlineStatus();
// When the socket connects or disconnects, re-check online status immediately
socketManager.onConnect(() => trackOnlineStatus());
socketManager.onDisconnect(() => trackOnlineStatus());

const router = createHashRouter([
  {
    path: "/",
    element: <Root />,
    children: [
      {
        index: true,
        element: <Home />,
      },

      {
        path: "runbooks",
        element: <Runbooks />,
      },

      {
        path: "history",
        element: <History />,
      },

      {
        path: "stats",
        element: <Stats />,
      },

      {
        path: "settings",
        element: <SettingsPanel />,
      },
    ],
  },
]);

const debouncedSaveWindowInfo = debounce(async () => {
  invoke("save_window_info");
}, 500);

event.listen("tauri://move", debouncedSaveWindowInfo);
event.listen("tauri://resize", debouncedSaveWindowInfo);

function Application() {
  const { refreshUser, refreshCollaborations, online, user } = useStore();
  const globalOptions = getGlobalOptions();

  useEffect(() => {
    if (online) {
      refreshUser();
    }
  }, [online]);

  useEffect(() => {
    if (online) {
      refreshCollaborations();
    }
  }, [online, user]);

  useEffect(() => {
    // Start up listeners for all known workspaces
    Workspace.all()
      .then((workspaces) => {
        for (const workspace of workspaces) {
          SharedStateManager.startInstance(
            `workspace-folder:${workspace.get("id")}`,
            new AtuinSharedStateAdapter(`workspace-folder:${workspace.get("id")}`),
          );
        }
      })
      .catch((err: any) => {
        console.error("Error starting shared state managers");
        console.error(err);
      });
  }, []);

  useEffect(() => {
    startupOperationProcessor();
  }, []);

  return (
    <React.StrictMode>
      <DndProvider backend={HTML5Backend}>
        <HeroUIProvider>
          <ToastProvider placement="bottom-center" toastOffset={40} />
          <QueryClientProvider client={queryClient}>
            <main className="text-foreground bg-background overflow-hidden">
              {AtuinEnv.isProd && globalOptions.customTitleBar && (
                <div data-tauri-drag-region className="w-full min-h-8 z-10 border-b-1" />
              )}
              {AtuinEnv.isDev && globalOptions.customTitleBar && (
                <div
                  data-tauri-drag-region
                  className="w-full min-h-8 z-10 border-b-1 bg-striped dark:bg-dark-striped bg-[length:7px_7px]"
                />
              )}

              <div className="z-20 relative">
                <RouterProvider router={router} />
              </div>
            </main>
          </QueryClientProvider>
        </HeroUIProvider>
      </DndProvider>
    </React.StrictMode>
  );
}

async function setup() {
  const currentVersion = await invoke<string>("get_app_version");
  useStore.getState().setCurrentVersion(currentVersion);
}

(async () => {
  await setup();
  ReactDOM.createRoot(document.getElementById("root")!).render(<Application />);
  invoke("show_window");
})();
