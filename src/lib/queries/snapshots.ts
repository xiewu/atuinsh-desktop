import Snapshot from "@/state/runbooks/snapshot";
import { queryOptions } from "@tanstack/react-query";
import { localQuery } from "./local_query";

export function snapshotsByRunbook(runbookId: string | undefined) {
  return queryOptions({
    ...localQuery,
    queryKey: ["snapshots", runbookId],
    queryFn: () => {
      if (runbookId) {
        return Snapshot.findByRunbookId(runbookId);
      } else {
        return Promise.resolve([]);
      }
    },
  });
}

export function snapshotByRunbookAndTag(runbookId: string | undefined, tag: string | undefined) {
  return queryOptions({
    ...localQuery,
    queryKey: ["snapshot", runbookId, tag],
    queryFn: () => {
      if (runbookId && tag && tag !== "latest") {
        return Snapshot.findByRunbookIdAndTag(runbookId, tag);
      } else {
        return Promise.resolve(null);
      }
    },
  });
}
