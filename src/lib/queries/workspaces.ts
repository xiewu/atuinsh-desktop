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
