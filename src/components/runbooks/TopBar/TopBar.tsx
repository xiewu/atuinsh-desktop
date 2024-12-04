import Runbook from "@/state/runbooks/runbook";
import { useStore } from "@/state/store";
import { useEffect, useState } from "react";
import { DateTime } from "luxon";

import { getRunbookID } from "@/api/api";

export default function Topbar(_props: any) {
  let currentRunbook = useStore((state) => state.currentRunbook);
  const [runbook, setRunbook] = useState<Runbook | null>(null);
  const [_remoteRunbook, setRemoteRunbook] = useState<any | null>(null);

  const runbookReload = async () => {
    if (!currentRunbook) {
      setRunbook(null);
      return;
    }

    let runbook = await Runbook.load(currentRunbook);
    setRunbook(runbook);

    try {
      if (!runbook) return;
      let rb = await getRunbookID(runbook.id);
      if (rb) setRemoteRunbook(rb);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    setRemoteRunbook(null);
    runbookReload();
  }, [currentRunbook]);

  const renderBarContents = () => {
    if (!runbook) return null;

    return (
      <>
        <div className="flex flex-row">
          <div className="h-full content-center">{runbook && runbook.name}</div>
        </div>
        <div className="flex flex-row gap-2">
          <div className="h-full content-center text-gray-400 text-xs italic">
            Updated {DateTime.fromJSDate(runbook.updated).toRelative()}
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="flex w-full max-w-full overflow-hidden bg-gray-50 h-10 min-h-10 flex-row border-b px-2 justify-between">
      {renderBarContents()}
    </div>
  );
}
