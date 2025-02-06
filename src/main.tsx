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
import { HeroUIProvider } from "@heroui/react";
import { QueryClientProvider } from "@tanstack/react-query";
import "./styles.css";

import Root from "@/routes/root/Root";
import Home from "@/routes/home/Home";
import Runbooks from "@/routes/runbooks/Runbooks";
import History from "@/routes/history/History";
import * as api from "./api/api";
import SocketManager from "./socket";
import SyncManager from "./lib/sync/sync_manager";
import { useStore } from "@/state/store";
import ServerNotificationManager from "./server_notification_manager";
import { trackOnlineStatus } from "./lib/online_tracker";
import Workspace from "./state/runbooks/workspace";
import Runbook from "./state/runbooks/runbook";
import welcome from "@/state/runbooks/welcome.json";
import Logger from "./lib/logger";
import AtuinEnv from "./atuin_env";
import { setupColorModes } from "./lib/color_modes";
import { setupServerEvents } from "./lib/server_events";
import SettingsPanel from "./components/Settings/Settings";
import { invoke } from "@tauri-apps/api/core";
import debounce from "lodash.debounce";
import { getGlobalOptions } from "./lib/global_options";
const logger = new Logger("Main");

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

  return (
    <React.StrictMode>
      <HeroUIProvider>
        <QueryClientProvider client={queryClient}>
          <main className="text-foreground bg-background">
            {AtuinEnv.isProd && globalOptions.customTitleBar && (
              <div data-tauri-drag-region className="w-full min-h-8 z-10 border-b-1" />
            )}
            {AtuinEnv.isDev && globalOptions.customTitleBar && (
              <div
                data-tauri-drag-region
                className="w-full min-h-8 z-10 border-b-1 bg-striped dark:bg-dark-striped bg-[length:7px_7px]"
              />
            )}

            <div className="z-20 ">
              <RouterProvider router={router} />
            </div>
          </main>
        </QueryClientProvider>
      </HeroUIProvider>
      <div id="portal" />
    </React.StrictMode>
  );
}

async function setup() {
  const { currentWorkspaceId, setCurrentWorkspaceId, setCurrentRunbookId } = useStore.getState();

  // Ensure at least one workspace exists
  let wss = await Workspace.all();
  let ws;
  if (wss.length === 0) {
    ws = await Workspace.create("Default Workspace");
    wss = [ws];
  }

  let wsId = currentWorkspaceId;
  if (!wsId || !wss.some((ws) => ws.id === wsId)) {
    wsId = wss[0].id;
    setCurrentWorkspaceId(wsId);
  }

  // Ensure runbooks have a workspace assigned
  // Workspaces didn't exist to start with,
  // so for some users could be null
  const rbs = await Runbook.withNullWorkspaces();
  let promises = [];
  for (let rb of rbs) {
    rb.workspaceId = wsId;
    promises.push(rb.save());
  }

  // It's also possible for a runbook to have a workspace_id that doesn't
  // actually exist -- for example, a sync happened when `currentWorkspaceId`
  // wasn't set right.
  //
  // This likely only happens in dev, when removing the SQLite database files
  // and logging in as a new user.
  const runbooks = await Runbook.selectWhere("workspace_id NOT IN (SELECT id FROM workspaces)");
  for (const runbook of runbooks) {
    runbook.moveTo(wsId);
  }

  const allRbIds = await Runbook.allIdsInAllWorkspaces();
  if (allRbIds.length === 0) {
    let runbook = await Runbook.create(wsId);

    runbook.name = "Welcome to Atuin!";
    runbook.content = JSON.stringify(welcome);
    await runbook.save();
    setCurrentRunbookId(runbook.id);
  }

  useStore.getState().refreshRunbooks();
  await Promise.allSettled(promises);
}

(async () => {
  await logger.time("Running setup...", setup);
  ReactDOM.createRoot(document.getElementById("root")!).render(<Application />);
  invoke("show_window");
})();
