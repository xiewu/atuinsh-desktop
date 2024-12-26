// [MKT] NextUI seems to have added a logging function that depends on checking
// for the `NODE_ENV` environment variable in the `process` object. It throws
// an exception when trying to access the global `process` object, so this
// shims out NODE_ENV with the Tauri env.
(window as any).process = (window as any).process || {
  env: {
    NODE_ENV: import.meta.env.MODE,
  },
};

import React from "react";
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
import { getHubApiToken } from "./api/api";
import SocketManager from "./socket";
import CollaborationManager from "./lib/collaboration_manager";
import { useStore } from "@/state/store";
import ServerNotificationManager from "./server_notification_manager";

(async () => {
  try {
    const token = await getHubApiToken();
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

new CollaborationManager(SocketManager.get(), useStore);
ServerNotificationManager.get().setQueryClient(queryClient);

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

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <NextUIProvider>
      <QueryClientProvider client={queryClient}>
        <main className="text-foreground bg-background">
          <div data-tauri-drag-region className="w-full min-h-8 z-10 border-b-1" />

          <div className="z-20 ">
            <RouterProvider router={router} />
          </div>
        </main>
      </QueryClientProvider>
    </NextUIProvider>
    <div id="portal" />
  </React.StrictMode>,
);
