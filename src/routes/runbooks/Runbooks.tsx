import Editor from "@/components/runbooks/editor/Editor";
import List from "@/components/runbooks/List/List";
import { usePtyStore } from "@/state/ptyStore";
import Runbook from "@/state/runbooks/runbook";

import { useStore } from "@/state/store";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function Runbooks() {
  const currentRunbook = useStore((store) => store.currentRunbook);
  const setCurrentRunbook = useStore((store) => store.setCurrentRunbook);
  const refreshRunbooks = useStore((store) => store.refreshRunbooks);

  const location = useLocation();

  const listenPtyBackend = usePtyStore((state) => state.listenBackend);
  const unlistenPtyBackend = usePtyStore((state) => state.unlistenBackend);

  useEffect(() => {
    (async () => {
      await listenPtyBackend();

      if (location.state?.createNew) {
        window.getSelection()?.removeAllRanges();

        let runbook = await Runbook.create();
        setCurrentRunbook(runbook.id);
        refreshRunbooks();
      }
    })();

    return () => {
      unlistenPtyBackend();
    };
  }, []);

  return (
    <div className="flex !w-full !max-w-full flex-row overflow-hidden">
      <List />
      {currentRunbook && (
        <div className="flex w-full max-w-full overflow-hidden">
          <Editor />
        </div>
      )}

      {!currentRunbook && (
        <div className="flex align-middle justify-center flex-col h-screen w-full">
          <h1 className="text-center">Select or create a runbook</h1>
        </div>
      )}
    </div>
  );
}
