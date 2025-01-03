import Runbook from "@/state/runbooks/runbook";
import { useStore } from "@/state/store";
import { useQuery } from "@tanstack/react-query";
import { runbookById } from "./queries/runbooks";

export function useRunbook(id: string | undefined): Runbook | null {
  const query = useQuery(runbookById(id));

  if (query.isFetched) {
    return query.data || null;
  } else {
    return null;
  }
}

export function useCurrentRunbook(): Runbook | null {
  const currentRunbookId = useStore((state) => state.currentRunbookId);
  return useRunbook(currentRunbookId || undefined);
}
