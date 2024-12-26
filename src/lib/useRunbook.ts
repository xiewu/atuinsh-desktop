import Runbook from "@/state/runbooks/runbook";
import { useStore } from "@/state/store";
import { useQuery } from "@tanstack/react-query";

export function useRunbook(id: string | null): Runbook | undefined {
  const query = useQuery({
    queryKey: ["runbook", id],
    queryFn: () => {
      if (id) {
        return Runbook.load(id);
      } else {
        return Promise.resolve(undefined);
      }
    },
  });

  if (query.isFetched) {
    return query.data || undefined;
  } else {
    return undefined;
  }
}

export function useCurrentRunbook(): Runbook | undefined {
  const currentRunbookId = useStore((state) => state.currentRunbookId);
  return useRunbook(currentRunbookId);
}
