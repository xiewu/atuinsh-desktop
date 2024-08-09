import React from "react";
import ReactDOM from "react-dom/client";
import { createHashRouter, RouterProvider } from "react-router-dom";
import { NextUIProvider } from "@nextui-org/react";
import "./styles.css";

import Root from "@/routes/root/Root";
import Home from "@/routes/home/Home";
import Dotfiles from "@/routes/dotfiles/Dotfiles";
import Runbooks from "@/routes/runbooks/Runbooks";
import History from "@/routes/history/History";
import * as Sentry from "@sentry/react";
import { KVStore } from "./state/kv";

(async () => {
  let db = await KVStore.open_default();
  let track_errors = await db.get("usage_tracking");

  if (track_errors) {
    console.log("User opted-in to error tracking");

    Sentry.init({
      dsn: "https://ac8c00adf29c329694a0b105e1981ca3@o4507730431442944.ingest.us.sentry.io/4507741947232256",
    });
  } else {
    console.log("User did not opt-in to error tracking");
  }
})();

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
        path: "dotfiles",
        element: <Dotfiles />,
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
  </React.StrictMode>,
);
