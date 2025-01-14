// [MKT] NextUI seems to have added a logging function that depends on checking
// for the `NODE_ENV` environment variable in the `process` object. It throws
// an exception when trying to access the global `process` object, so this
// shims out NODE_ENV with the Tauri env.
(window as any).process = (window as any).process || {
  env: {
    NODE_ENV: import.meta.env.MODE,
  },
};

import { event } from "@tauri-apps/api";
import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import { createHashRouter, RouterProvider } from "react-router-dom";
import { NextUIProvider } from "@nextui-org/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./styles.css";

import Root from "@/routes/root/Root";
import Home from "@/routes/home/Home";
import Runbooks from "@/routes/runbooks/Runbooks";
import History from "@/routes/history/History";
import { init_tracking } from "./tracking";
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 1000 * 60 * 5,
    },
  },
});
(window as any).queryClient = queryClient;

const socketManager = SocketManager.get();
const notificationManager = ServerNotificationManager.get();
const syncManager = SyncManager.get(useStore);

event.listen("tauri://blur", () => {
  useStore.getState().setFocused(false);
});

event.listen("tauri://focus", () => {
  useStore.getState().setFocused(true);
});

notificationManager.on("runbook_updated", (runbookId: string) => {
  syncManager.runbookUpdated(runbookId);
  queryClient.invalidateQueries({ queryKey: ["remote_runbook", runbookId] });
});

notificationManager.on("runbook_deleted", (runbookId: string) => {
  syncManager.runbookUpdated(runbookId);
  queryClient.invalidateQueries({ queryKey: ["remote_runbook", runbookId] });
});

notificationManager.on("collab_invited", async (collabId: string) => {
  try {
    const collab = await api.getCollaborationById(collabId);
    useStore.getState().addCollaboration(collab);
  } catch (err) {}
});

notificationManager.on("collab_accepted", async (collabId: string) => {
  useStore.getState().markCollaborationAccepted(collabId);
  try {
    const collab = await api.getCollaborationById(collabId);
    syncManager.runbookUpdated(collab.runbook.id);
  } catch (err) {}
});

notificationManager.on("collab_deleted", (collabId: string) => {
  const { collaborations, removeCollaboration } = useStore.getState();
  const collaboration = collaborations.find((c) => c.id === collabId);
  if (collaboration) {
    syncManager.runbookUpdated(collaboration.runbook.id);
  }
  removeCollaboration(collabId);
});

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
    ],
  },
]);

function Application() {
  const { refreshUser, refreshCollaborations, online, user } = useStore();

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
      <NextUIProvider>
        <QueryClientProvider client={queryClient}>
          <main className="text-foreground bg-background">
            {AtuinEnv.isProd && (
              <div data-tauri-drag-region className="w-full min-h-8 z-10 border-b-1" />
            )}
            {AtuinEnv.isDev && (
              <div
                data-tauri-drag-region
                className="w-full min-h-8 z-10 border-b-1 bg-striped bg-[length:7px_7px]"
              />
            )}

            <div className="z-20 ">
              <RouterProvider router={router} />
            </div>
          </main>
        </QueryClientProvider>
      </NextUIProvider>
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
})();
