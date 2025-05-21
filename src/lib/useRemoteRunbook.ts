import { useEffect } from "react";
import Runbook from "@/state/runbooks/runbook";
import { useQuery } from "@tanstack/react-query";
import { RemoteRunbook } from "@/state/models";
import { remoteRunbook } from "./queries/runbooks";

export default function useRemoteRunbook(
  runbook?: Runbook,
): [RemoteRunbook | null | undefined, () => void] {
  const query = useQuery(remoteRunbook(runbook));

  useEffect(() => {
    if (!runbook || !query.isFetched) return;

    if (query.isSuccess) {
      const newRemoteInfo = query.data ? JSON.stringify(query.data) : null;
      const currentRemoteInfo = runbook.remoteInfo ? JSON.stringify(runbook.remoteInfo) : null;

      if (newRemoteInfo != currentRemoteInfo) {
        runbook.remoteInfo = newRemoteInfo;
        runbook.save();
      }
    } else if (query.isError && runbook.remoteInfo !== null) {
      runbook.remoteInfo = null;
      runbook.save();
    }
  }, [runbook?.id, query.isSuccess, query.isFetched, query.data]);

  return [query.data, query.refetch];
}
