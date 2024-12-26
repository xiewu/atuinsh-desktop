import { useEffect } from "react";
import { getRunbookID } from "@/api/api";
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
        } catch (err) {
          return null;
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

  if (query.isError) {
    return [null, query.refetch];
  } else {
    return [query.data, query.refetch];
  }
}
