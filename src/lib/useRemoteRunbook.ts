import { useEffect, useState } from "react";
import { getRunbookID } from "@/api/api";
import { RemoteRunbook } from "@/state/models";
import Runbook from "@/state/runbooks/runbook";
import Logger from "./logger";
import { useStore } from "@/state/store";
const logger = new Logger("useRemoteRunbook");

function getCachedRemoteInfo(runbook?: Runbook) {
  if (runbook?.remoteInfo) {
    return JSON.parse(runbook.remoteInfo);
  } else {
    return null;
  }
}

const requestCache = new Map<string, Promise<any>>();
function getRunbookById(id: string) {
  if (requestCache.has(id)) {
    return requestCache.get(id);
  } else {
    const promise = getRunbookID(id);
    requestCache.set(id, promise);
    promise
      .catch(() => {})
      .finally(() => {
        requestCache.delete(id);
      });
    return promise;
  }
}

export default function useRemoteRunbook(runbook?: Runbook): RemoteRunbook | undefined {
  const [remoteRunbook, setRemoteRunbook] = useState<RemoteRunbook | undefined>(undefined);
  const [cachedRunbook, setCachedRunbook] = useState<RemoteRunbook | undefined>(() =>
    getCachedRemoteInfo(runbook),
  );
  const user = useStore((state) => state.user);

  useEffect(() => {
    (async () => {
      if (!runbook) {
        setRemoteRunbook(undefined);
        return;
      }

      try {
        const remoteRunbook = await getRunbookById(runbook.id);
        const newRemoteInfo = JSON.stringify(remoteRunbook);
        if (newRemoteInfo !== runbook.remoteInfo) {
          runbook.remoteInfo = JSON.stringify(remoteRunbook);
          runbook.save();
        }
        setRemoteRunbook(remoteRunbook);
      } catch (err: any) {
        if (err.code && err.code == 404) {
          logger.warn("Runbook not found on remote; clearing cache.");
          setRemoteRunbook(undefined);
          setCachedRunbook(undefined);
          runbook.remoteInfo = null;
          runbook.save();
          return;
        } else {
          logger.warn("Failed to fetch runbook:", err);
          setRemoteRunbook(undefined);
          return;
        }
      }
    })();
  }, [runbook?.id, user]);

  return remoteRunbook || cachedRunbook;
}
