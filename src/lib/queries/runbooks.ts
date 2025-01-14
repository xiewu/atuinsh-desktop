import { queryOptions } from "@tanstack/react-query";
import { localQuery } from "./local_query";
import Runbook from "@/state/runbooks/runbook";
import { getRunbookID, HttpResponseError } from "@/api/api";
import AtuinEnv from "@/atuin_env";
import { RemoteRunbook } from "@/state/models";

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

export function remoteRunbook(runbook?: Runbook) {
  return queryOptions<RemoteRunbook | null>({
    staleTime: 1000 * 30,
    queryKey: ["remote_runbook", runbook?.id],
    queryFn: async () => {
      if (runbook) {
        try {
          const rb = await getRunbookID(runbook.id);
          return rb;
        } catch (err: any) {
          if (
            (err instanceof HttpResponseError &&
              err.code === 404 &&
              // Only clear out the cache on 404 if the runbook is from our environment or was created locally
              runbook.source === AtuinEnv.hubRunbookSource) ||
            runbook.source === "local"
          ) {
            return null;
          } else {
            throw err;
          }
        }
      } else {
        throw new Error("no runbook ID specified");
      }
    },
    initialData: runbook?.remoteInfo
      ? (JSON.parse(runbook.remoteInfo) as RemoteRunbook)
      : undefined,
    refetchOnMount: "always",
  });
}
