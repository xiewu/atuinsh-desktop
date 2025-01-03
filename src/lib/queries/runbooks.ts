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
