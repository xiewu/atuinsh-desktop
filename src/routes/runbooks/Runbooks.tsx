import Editor from "@/components/runbooks/editor/Editor";
import List from "@/components/runbooks/List/List";
import Topbar from "@/components/runbooks/TopBar/TopBar";
import { useTauriEvent } from "@/lib/tauri";
import useRemoteRunbook from "@/lib/useRemoteRunbook";
import { usePtyStore } from "@/state/ptyStore";
import { useStore } from "@/state/store";
import { save } from "@tauri-apps/plugin-dialog";
import Snapshot from "@/state/runbooks/snapshot";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useMemory } from "@/lib/utils";
import { useCurrentRunbook } from "@/lib/useRunbook";

export default function Runbooks() {
  const refreshUser = useStore((store) => store.refreshUser);
  const newRunbook = useStore((store) => store.newRunbook);
  const getLastTagForRunbook = useStore((store) => store.getLastTagForRunbook);
  const setLastTagForRunbook = useStore((store) => store.selectTag);
  const currentRunbook = useCurrentRunbook();
  const lastRunbookRef = useMemory(currentRunbook);

  const [showTagMenu, setShowTagMenu] = useState(false);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [selectedTag, setSelectedTag] = useState<string>(() => {
    let tag = currentRunbook ? getLastTagForRunbook(currentRunbook.id) : "latest";
    if (!tag) tag = "latest";
    if (tag == "(no tag)") tag = "latest";

    return tag;
  });
  const remoteRunbook = useRemoteRunbook(currentRunbook || undefined);
  const [currentSnapshot, setCurrentSnapshot] = useState<Snapshot | null>(null);

  const location = useLocation();

  const listenPtyBackend = usePtyStore((state) => state.listenBackend);
  const unlistenPtyBackend = usePtyStore((state) => state.unlistenBackend);

  useEffect(() => {
    if (!currentRunbook) {
      setSelectedTag("latest");
      return;
    }

    let tag = getLastTagForRunbook(currentRunbook.id) || "latest";
    if (tag == "(no tag)") tag = "latest";
    setSelectedTag(tag);
  }, [currentRunbook?.id]);

  useEffect(() => {
    (async () => {
      if (!currentRunbook) {
        setSnapshots([]);
        return;
      }

      let snapshots = await Snapshot.findByRunbookId(currentRunbook.id);
      setSnapshots(snapshots);
    })();
  }, [currentRunbook]);

  useEffect(() => {
    (async () => {
      if (!currentRunbook || selectedTag == "latest") {
        setCurrentSnapshot(null);
        return;
      }

      let snapshot = await Snapshot.findByRunbookIdAndTag(currentRunbook.id, selectedTag);
      setCurrentSnapshot(snapshot);
    })();
  }, [currentRunbook, selectedTag]);

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
    if (!tag) tag = "latest";
    setSelectedTag(tag);
    setShowTagMenu(false);
    if (currentRunbook) {
      setLastTagForRunbook(currentRunbook.id, tag);
    }
  }

  async function handleCreateTag(tag: string) {
    if (!currentRunbook) {
      throw new Error("Tried to create a new tag with no runbook selected");
    }
    // 1. Create new local snapshot
    let snapshot = await Snapshot.create(tag, currentRunbook.id, currentRunbook.content);
    let snapshots = await Snapshot.findByRunbookId(currentRunbook.id);
    // 2. Create remote snapshot
    // 3. If creating remote shapshot fails, delete local snapshot???

    setLastTagForRunbook(currentRunbook.id, snapshot.tag);
    if (currentRunbook == lastRunbookRef.current) {
      setSnapshots(snapshots);
      setSelectedTag(snapshot.tag);
      setShowTagMenu(false);
    }
  }

  const editable = !remoteRunbook || remoteRunbook?.permissions.includes("update_content");
  const canEditTags = !remoteRunbook || remoteRunbook?.permissions.includes("update");
  const canInviteCollabs = remoteRunbook?.permissions.includes("update");

  return (
    <div className="flex !w-full !max-w-full flex-row overflow-hidden">
      <List />
      {currentRunbook && (
        <div className="flex w-full max-w-full overflow-hidden flex-col">
          <Topbar
            runbook={currentRunbook}
            remoteRunbook={remoteRunbook}
            tags={snapshots.map((snap) => snap.tag)}
            showTagMenu={showTagMenu}
            onOpenTagMenu={() => setShowTagMenu(true)}
            onCloseTagMenu={() => setShowTagMenu(false)}
            currentTag={selectedTag}
            onSelectTag={handleSelectTag}
            canEditTags={canEditTags}
            canInviteCollaborators={!!canInviteCollabs}
            onCreateTag={handleCreateTag}
          />
          <Editor
            runbook={currentRunbook}
            snapshot={currentSnapshot || null}
            editable={editable && selectedTag == "latest"}
          />
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
