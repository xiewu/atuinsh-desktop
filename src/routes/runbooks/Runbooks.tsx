import * as Sentry from "@sentry/react";
import useRemoteRunbook from "@/lib/useRemoteRunbook";
import { usePtyStore } from "@/state/ptyStore";
import { useStore } from "@/state/store";
import Snapshot from "@/state/runbooks/snapshot";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMemory } from "@/lib/utils";
import { useCurrentRunbook } from "@/lib/useRunbook";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/api/api";
import { snapshotByRunbookAndTag, snapshotsByRunbook } from "@/lib/queries/snapshots";
import Runbook from "@/state/runbooks/runbook";
import { PresenceUserInfo } from "@/lib/phoenix_provider";
import RunbookEditor from "@/lib/runbook_editor";
import Operation from "@/state/runbooks/operation";
import { ConnectionState } from "@/state/store/user_state";
import { DialogBuilder } from "@/components/Dialogs/dialog";
import AppBus from "@/lib/app/app_bus";

const Editor = React.lazy(() => import("@/components/runbooks/editor/Editor"));
const Topbar = React.lazy(() => import("@/components/runbooks/TopBar/TopBar"));

function useMarkRunbookRead(runbook: Runbook | null, refreshRunbooks: () => void) {
  useEffect(() => {
    if (runbook) {
      runbook.markViewed().then(() => {
        refreshRunbooks();
      });
    }
  }, [runbook?.id]);
}

export default function Runbooks() {
  const user = useStore((store) => store.user);
  const connectionState = useStore((store) => store.connectionState);
  const refreshRunbooks = useStore((store) => store.refreshRunbooks);
  const getLastTagForRunbook = useStore((store) => store.getLastTagForRunbook);
  const setLastTagForRunbook = useStore((store) => store.selectTag);
  const currentRunbook = useCurrentRunbook();
  const lastRunbookRef = useMemory(currentRunbook);
  const [presences, setPresences] = useState<PresenceUserInfo[]>([]);
  const [runbookEditor, setRunbookEditor] = useState<RunbookEditor | null>(null);
  const lastRunbookEditor = useRef<RunbookEditor | null>(runbookEditor);
  const serialExecution = useStore((store) => store.serialExecution);

  // Key used to re-render editor when making major changes to runbook
  const [editorKey, setEditorKey] = useState<boolean>(false);
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(() => {
    let tag = currentRunbook ? getLastTagForRunbook(currentRunbook.id) : null;
    if (tag == "(no tag)") tag = null;

    return tag;
  });

  const listenPtyBackend = usePtyStore((state) => state.listenBackend);
  const unlistenPtyBackend = usePtyStore((state) => state.unlistenBackend);

  const queryClient = useQueryClient();

  const [remoteRunbook, refreshRemoteRunbook] = useRemoteRunbook(currentRunbook || undefined);
  const { data: currentSnapshot } = useQuery(
    snapshotByRunbookAndTag(currentRunbook?.id, selectedTag),
  );
  const { data: snapshots, isFetching: snapshotsFetching } = useQuery(
    snapshotsByRunbook(currentRunbook?.id),
  );

  useEffect(() => {
    if (remoteRunbook && !remoteRunbook.owner) {
      console.log("Refreshing remote runbook");
      refreshRemoteRunbook();
    }
  }, [remoteRunbook]);

  const tags = useMemo(() => {
    let tags = (snapshots || []).map((snap) => ({ text: snap.tag, value: snap.tag })) || [];
    if (!remoteRunbook || remoteRunbook?.permissions.includes("update_content")) {
      tags = [{ text: "(no tag)", value: "latest" }, ...tags];
    }

    return tags;
  }, [snapshots, remoteRunbook]);

  function updateEditorKey() {
    setEditorKey((prev) => !prev);
  }

  const shareSnapshot = useMutation({
    mutationFn: async (snapshot: Snapshot) => {
      return api.createSnapshot(snapshot);
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
    setPresences([]);
  }, [currentRunbook?.id, currentSnapshot?.id]);

  function onPresenceJoin(user: PresenceUserInfo) {
    setPresences((prev) => {
      const index = prev.findIndex((u) => u.id == user.id);
      if (index > -1) {
        const before = prev.slice(0, index);
        const after = prev.slice(index + 1);
        return [...before, user, ...after];
      } else {
        return [...prev, user];
      }
    });
  }

  function onPresenceLeave(user: PresenceUserInfo) {
    setPresences((prev) => prev.filter((u) => u.id != user.id));
  }

  function onClearPresences() {
    setPresences([]);
  }

  useEffect(() => {
    if (!currentRunbook) {
      setSelectedTag(null);
      return;
    }

    refreshRemoteRunbook();

    let tag = getLastTagForRunbook(currentRunbook.id);
    if (tag == "(no tag)") tag = null;
    setSelectedTag(tag);
  }, [currentRunbook?.id]);

  useEffect(() => {
    if (!snapshots || !currentRunbook || snapshotsFetching) return;

    const tagExists = tags.some((tag) => tag.value == selectedTag);
    if (tagExists) return;

    if (!tagExists && tags.some((tag) => tag.value == "latest")) {
      setSelectedTag("latest");
    } else if (!tagExists) {
      setSelectedTag(tags[0]?.value || null);
    }
  }, [selectedTag, snapshots, tags, snapshotsFetching]);

  useMarkRunbookRead(currentRunbook, refreshRunbooks);

  useEffect(() => {
    listenPtyBackend();
    return unlistenPtyBackend;
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

    let snapshot = await Snapshot.create({
      id: undefined,
      tag,
      runbook_id: currentRunbook.id,
      content: currentRunbook.content,
    });
    queryClient.invalidateQueries({ queryKey: snapshotsByRunbook(currentRunbook.id).queryKey });

    if (remoteRunbook) {
      shareSnapshot.mutate(snapshot, {
        onError: (_err) => {
          // TODO: how to handle if creating remote snapshot fails?
        },
      });
    }

    setLastTagForRunbook(currentRunbook.id, snapshot.tag);
    if (currentRunbook == lastRunbookRef.current) {
      setSelectedTag(snapshot.tag);
      setShowTagMenu(false);
    }
  }

  async function handleDeleteTag(tag: string) {
    if (!currentRunbook) {
      throw new Error("Tried to delete a tag with no runbook selected");
    }

    let snaps = snapshots || [];

    const currentIndex = snaps.findIndex((snap) => snap.tag == tag);
    if (currentIndex == -1) return;

    const current = snaps[currentIndex];
    const before = snaps[currentIndex - 1];
    const after = snaps[currentIndex + 1];
    let newTag = after ? after.tag : before ? before.tag : "latest";

    setSelectedTag(newTag);
    const id = current.id;
    await current.delete();

    if (connectionState !== ConnectionState.Offline) {
      const op = new Operation({
        operation: { type: "snapshot_deleted", snapshotId: id },
      });
      await op.save();
    } else {
      await api.deleteSnapshot(current.id);
    }
  }

  async function handleSharedToHub() {
    await currentRunbook?.clearRemoteInfo();
    lastRunbookEditor.current?.resetEditor();
    refreshRemoteRunbook();
    updateEditorKey();
  }

  async function handleDeletedFromHub() {
    await currentRunbook?.clearRemoteInfo();
    lastRunbookEditor.current?.resetEditor();
    refreshRemoteRunbook();
    updateEditorKey();
  }

  useEffect(() => {
    const unsub = AppBus.get().onResetEditor((rbId: string) => {
      console.log("Resetting editor instance", rbId, currentRunbook?.id);
      if (rbId == currentRunbook?.id) {
        lastRunbookEditor.current?.resetEditor();
        updateEditorKey();
      }
    });

    return unsub;
  }, [currentRunbook?.id]);

  function handleShowTagMenu() {
    if (serialExecution) {
      new DialogBuilder()
        .title("Cannot switch tags")
        .message("You cannot switch tags while a runbook is executing a workflow.")
        .action({
          label: "OK",
          value: "ok",
          color: "primary",
        })
        .build();
    } else {
      setShowTagMenu(true);
    }
  }

  useEffect(() => {
    if (lastRunbookEditor.current) {
      lastRunbookEditor.current.shutdown();
      setRunbookEditor(null);
    }

    if (!currentRunbook) {
      return;
    }

    const newRunbookEditor = new RunbookEditor(
      currentRunbook,
      user,
      selectedTag,
      onPresenceJoin,
      onPresenceLeave,
      onClearPresences,
    );
    lastRunbookEditor.current = newRunbookEditor;
    setEditorKey((prev) => !prev);
    setRunbookEditor(newRunbookEditor);
  }, [currentRunbook?.id]);

  useEffect(() => {
    if (!currentRunbook || !runbookEditor) return;

    if (runbookEditor.runbook.id !== currentRunbook.id) return;

    runbookEditor.updateRunbook(currentRunbook);
    runbookEditor.updateUser(user);
    runbookEditor.updateSelectedTag(selectedTag);
    setRunbookEditor(runbookEditor);
  }, [runbookEditor, currentRunbook, user, selectedTag]);

  const editable = !remoteRunbook || remoteRunbook?.permissions.includes("update_content");
  const canEditTags = !remoteRunbook || remoteRunbook?.permissions.includes("update");
  const canInviteCollabs = remoteRunbook?.permissions.includes("update");
  const hasNoTags = tags.length == 0;

  const readyToRender =
    runbookEditor &&
    (selectedTag == "latest" ||
      (currentSnapshot && selectedTag == currentSnapshot.tag) ||
      (selectedTag == null && hasNoTags));

  return (
    <div className="flex !w-full !max-w-full flex-row overflow-hidden">
      {currentRunbook && readyToRender && (
        <div className="flex w-full max-w-full overflow-hidden flex-col">
          <Topbar
            runbook={currentRunbook}
            remoteRunbook={remoteRunbook || undefined}
            tags={tags}
            presences={presences}
            showTagMenu={showTagMenu}
            onOpenTagMenu={handleShowTagMenu}
            onCloseTagMenu={() => setShowTagMenu(false)}
            currentTag={selectedTag}
            onSelectTag={handleSelectTag}
            canEditTags={canEditTags}
            canInviteCollaborators={!!canInviteCollabs}
            onCreateTag={handleCreateTag}
            onDeleteTag={handleDeleteTag}
            onShareToHub={handleSharedToHub}
            onDeleteFromHub={handleDeletedFromHub}
          />
          <Sentry.ErrorBoundary showDialog={false}>
            {!hasNoTags && (
              <Editor
                key={editorKey ? "1" : "2"}
                runbook={currentRunbook}
                runbookEditor={runbookEditor}
                editable={editable && selectedTag == "latest"}
              />
            )}
            {hasNoTags && (
              <div className="flex align-middle justify-center flex-col h-screen w-full">
                <h1 className="text-center">This runbook has no published tags</h1>
              </div>
            )}
          </Sentry.ErrorBoundary>
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
