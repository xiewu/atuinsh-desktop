import Datastore, { CachedModel } from "@/datastore";
import { useMemory } from "./utils";
import { useEffect, useState } from "react";
import Runbook from "@/state/runbooks/runbook";
import { useStore } from "@/state/store";

export function useRunbook(id: string | null): Runbook | undefined {
  const datastore = Datastore.get();
  const [runbook, setRunbook] = useState<Runbook | undefined>();
  const [cachedRunbook, setCachedRunbook] = useState<CachedModel<Runbook> | undefined>();
  const cachedRunbookRef = useMemory(cachedRunbook);
  const lastId = useMemory(id);

  useEffect(() => {
    let unsub = () => {};
    let cancelled = false;

    function doSetRunbook(runbook: CachedModel<Runbook> | undefined) {
      if (id === lastId.current && !cancelled) {
        setCachedRunbook(runbook);
        setRunbook(runbook?.model);
      }
    }

    (async () => {
      if (id) {
        const runbook = await datastore.getRunbook(id);
        // Ensure the effect hasn't been cancelled and that the id hasn't changed
        if (runbook && id === lastId.current && !cancelled) {
          datastore.addRef(runbook);
          doSetRunbook(runbook);
          unsub = datastore.on(runbook.key, (newRunbook) => {
            doSetRunbook(newRunbook);
          });
        } else {
          doSetRunbook(undefined);
        }
      } else {
        doSetRunbook(undefined);
      }
    })();

    return () => {
      cancelled = true;
      if (cachedRunbookRef.current) {
        datastore.removeRef(cachedRunbookRef.current);
      }
      unsub();
    };
  }, [id]);

  return runbook;
}

export function useCurrentRunbook(): Runbook | undefined {
  const currentRunbookId = useStore((state) => state.currentRunbookId);
  return useRunbook(currentRunbookId);
}
