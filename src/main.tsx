import React from "react";
import ReactDOM from "react-dom/client";
import { createHashRouter, RouterProvider } from "react-router-dom";
import { NextUIProvider } from "@nextui-org/react";
import "./styles.css";

import Root from "@/routes/root/Root";
import Home from "@/routes/home/Home";
import Runbooks from "@/routes/runbooks/Runbooks";
import History from "@/routes/history/History";
import { init_tracking } from "./tracking";
import { getHubApiToken } from "./api/api";

import SocketManager from "./socket";
setTimeout(() => {
  getHubApiToken().then((token) => {
    SocketManager.setApiToken(token);
  });
}, 5000);

// If the user has opted in, we will setup sentry/posthog
init_tracking();

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
      <main className="text-foreground bg-background">
        <div
          data-tauri-drag-region
          className="w-full min-h-8 z-10 border-b-1"
        />

        <div className="z-20 ">
          <RouterProvider router={router} />
        </div>
      </main>
    </NextUIProvider>
    <div id="portal" />
  </React.StrictMode>,
);
