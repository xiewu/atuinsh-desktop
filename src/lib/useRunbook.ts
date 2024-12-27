import Runbook from "@/state/runbooks/runbook";
import { useStore } from "@/state/store";
import { useQuery } from "@tanstack/react-query";

export function useRunbook(id: string | null): Runbook | null {
  const query = useQuery({
    queryKey: ["runbook", id],
    queryFn: () => {
      if (id) {
        return Runbook.load(id);
      } else {
        return Promise.resolve(null);
      }
    },
    networkMode: "always",
    gcTime: 0,
  });

  if (query.isFetched) {
    return query.data || null;
  } else {
    return null;
  }
}

export function useCurrentRunbook(): Runbook | null {
  const currentRunbookId = useStore((state) => state.currentRunbookId);
  return useRunbook(currentRunbookId);
}
