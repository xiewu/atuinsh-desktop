import { queryOptions } from "@tanstack/react-query";
import { localQuery } from "./local_query";
import Runbook from "@/state/runbooks/runbook";

export function runbookById(id: string | undefined) {
  return queryOptions({
    ...localQuery,
    queryKey: ["runbook", id],
    queryFn: () => {
      if (id) {
        return Runbook.load(id);
      } else {
        return Promise.resolve(null);
      }
    },
  });
}

export function runbooksByWorkspaceId(workspaceId: string | undefined) {
  return queryOptions({
    ...localQuery,
    queryKey: ["runbooks", "workspace", workspaceId],
    queryFn: () => {
      if (workspaceId) {
        return Runbook.all(workspaceId);
      } else {
        return Promise.resolve([]);
      }
    },
  });
}

export function allRunbooks() {
  return queryOptions({
    ...localQuery,
    queryKey: ["runbooks", "all"],
    queryFn: () => Runbook.allInAllWorkspaces(),
  });
}

export function allRunbooksIds() {
  return queryOptions({
    ...localQuery,
    queryKey: ["runbooks", "all-ids"],
    queryFn: () => Runbook.allIdsInAllWorkspaces(),
  });
}
