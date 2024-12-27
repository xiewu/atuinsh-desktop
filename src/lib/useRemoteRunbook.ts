import { useEffect } from "react";
import { getRunbookID, HttpResponseError } from "@/api/api";
import Runbook from "@/state/runbooks/runbook";
import { useQuery } from "@tanstack/react-query";

export default function useRemoteRunbook(runbook?: Runbook) {
  const query = useQuery({
    queryKey: ["remote_runbook", runbook?.id],
    queryFn: async () => {
      if (runbook) {
        try {
          const rb = await getRunbookID(runbook.id);
          return rb;
        } catch (err: any) {
          if (err instanceof HttpResponseError && err.code === 404) return null;
          else throw err;
        }
      } else {
        throw new Error("no runbook ID specified");
      }
    },
    initialData: runbook?.remoteInfo ? JSON.parse(runbook.remoteInfo) : undefined,
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
