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
import { useMutation } from "@tanstack/react-query";
import { createSnapshot } from "@/api/api";
import { ErrorBoundary } from "@sentry/react";

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
  const [remoteRunbook, refreshRemoteRunbook] = useRemoteRunbook(currentRunbook || undefined);
  const [currentSnapshot, setCurrentSnapshot] = useState<Snapshot | null>(null);

  const location = useLocation();

  const listenPtyBackend = usePtyStore((state) => state.listenBackend);
  const unlistenPtyBackend = usePtyStore((state) => state.unlistenBackend);

  const shareSnapshot = useMutation({
    mutationFn: async (snapshot: Snapshot) => {
      return createSnapshot(snapshot);
    },
    onSuccess: (_data, snapshot) => {
      console.info(`Successfully created snapshot ${snapshot.tag}`);
    },
    onError: (err: any) => {
      console.error("Error creating snapshot", err);
    },
    scope: { id: `runbook` },
  });

  useEffect(() => {
    if (!currentRunbook) {
      setSelectedTag("latest");
      return;
    }

    refreshRemoteRunbook();

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

    let snapshot = await Snapshot.create(tag, currentRunbook.id, currentRunbook.content);
    let snapshots = await Snapshot.findByRunbookId(currentRunbook.id);

    if (remoteRunbook) {
      shareSnapshot.mutate(snapshot, {
        onError: (_err) => {
          // TODO: how to handle if creating remote snapshot fails?
        },
      });
    }

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

  const readyToRender = selectedTag == "latest" || selectedTag == currentSnapshot?.tag;

  return (
    <div className="flex !w-full !max-w-full flex-row overflow-hidden">
      <List />
      {currentRunbook && readyToRender && (
        <div className="flex w-full max-w-full overflow-hidden flex-col">
          <Topbar
            runbook={currentRunbook}
            remoteRunbook={remoteRunbook}
            refreshRemoteRunbook={refreshRemoteRunbook}
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
          <ErrorBoundary>
            <Editor
              runbook={currentRunbook}
              snapshot={currentSnapshot || null}
              editable={editable && selectedTag == "latest"}
            />
          </ErrorBoundary>
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
