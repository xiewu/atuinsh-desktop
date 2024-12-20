import Editor from "@/components/runbooks/editor/Editor";
import List from "@/components/runbooks/List/List";
import Topbar from "@/components/runbooks/TopBar/TopBar";
import { useTauriEvent } from "@/lib/tauri";
import { usePtyStore } from "@/state/ptyStore";

import { useStore } from "@/state/store";
import { save } from "@tauri-apps/plugin-dialog";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

export default function Runbooks() {
  const refreshUser = useStore((store) => store.refreshUser);
  const currentRunbook = useStore((store) => store.currentRunbook);
  const newRunbook = useStore((store) => store.newRunbook);
  const lastTagForRunbook = useStore((store) => {
    if (currentRunbook) {
      return store.getLastTagForRunbook(currentRunbook.id);
    } else {
      return null;
    }
  });
  const [selectedTag, _setSelectedTag] = useState(lastTagForRunbook);

  const location = useLocation();

  const listenPtyBackend = usePtyStore((state) => state.listenBackend);
  const unlistenPtyBackend = usePtyStore((state) => state.unlistenBackend);

  useTauriEvent("export-runbook", async () => {
    if (!currentRunbook) return;

    let filePath = await save({
      defaultPath: currentRunbook.name + ".atrb",
    });

    if (!filePath) return;

    currentRunbook.export(filePath);
  });

  useTauriEvent("export-markdown", async () => {
    if (!currentRunbook) return;

    let filePath = await save({
      defaultPath: currentRunbook.name + ".atmd",
    });

    if (!filePath) return;

    currentRunbook.exportMarkdown(filePath);
  });

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

  function handleSelectTag(tag: string | null) {
    console.log("User selected a tag:", tag);
  }

  return (
    <div className="flex !w-full !max-w-full flex-row overflow-hidden">
      <List />
      {currentRunbook && (
        <div className="flex w-full max-w-full overflow-hidden flex-col">
          <Topbar runbook={currentRunbook} currentTag={selectedTag} onSelectTag={handleSelectTag} />
          <Editor runbook={currentRunbook} />
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
