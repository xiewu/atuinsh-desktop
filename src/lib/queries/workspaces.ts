import { queryOptions } from "@tanstack/react-query";
import { localQuery } from "./local_query";
import Workspace from "@/state/runbooks/workspace";

export function allWorkspaces() {
  return queryOptions({
    ...localQuery,
    queryKey: ["workspaces"],
    queryFn: async () => {
      const wss = await Workspace.all();
      const promises = wss.map((ws) => ws.refreshMeta());
      await Promise.all(promises);
      return wss;
    },
  });
}

export function workspaceById(id: string) {
  return queryOptions({
    ...localQuery,
    queryKey: ["workspace", id],
    queryFn: async () => {
      const ws = await Workspace.findById(id);
      if (ws) {
        await ws.refreshMeta();
      }
      return ws;
    },
  });
}
