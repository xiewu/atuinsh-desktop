import Editor from "@/components/runbooks/editor/Editor";
import List from "@/components/runbooks/List/List";
import { usePtyStore } from "@/state/ptyStore";

import { useStore } from "@/state/store";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function Runbooks() {
  const refreshUser = useStore((store) => store.refreshUser);
  const currentRunbook = useStore((store) => store.currentRunbook);
  const newRunbook = useStore((store) => store.newRunbook);

  const location = useLocation();

  const listenPtyBackend = usePtyStore((state) => state.listenBackend);
  const unlistenPtyBackend = usePtyStore((state) => state.unlistenBackend);

  useEffect(() => {
    (async () => {
      await listenPtyBackend();
      await refreshUser();

      if (location.state?.createNew) {
        window.getSelection()?.removeAllRanges();

        await newRunbook();
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
