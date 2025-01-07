import { useEffect } from "react";
import { getRunbookID, HttpResponseError } from "@/api/api";
import Runbook from "@/state/runbooks/runbook";
import { useQuery } from "@tanstack/react-query";
import AtuinEnv from "@/atuin_env";
import { RemoteRunbook } from "@/state/models";

export default function useRemoteRunbook(
  runbook?: Runbook,
): [RemoteRunbook | null | undefined, () => void] {
  const query = useQuery<RemoteRunbook | null>({
    queryKey: ["remote_runbook", runbook?.id],
    queryFn: async () => {
      if (runbook) {
        try {
          const rb = await getRunbookID(runbook.id);
          return rb;
        } catch (err: any) {
          if (
            err instanceof HttpResponseError &&
            err.code === 404 &&
            // Only clear out the cache on 404 if the runbook is from our environment
            runbook.source === AtuinEnv.hubRunbookSource
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

  useEffect(() => {
    if (!runbook || !query.isFetched) return;

    if (query.isSuccess) {
      const newRemoteInfo = query.data ? JSON.stringify(query.data) : null;
      runbook.remoteInfo = newRemoteInfo;
      runbook.save();
    } else if (query.isError) {
      runbook.remoteInfo = null;
      runbook.save();
    }
  }, [runbook?.id, query.status]);

  return [query.data, query.refetch];
}
