import Workspace from "@/state/runbooks/workspace";
import useSharedState from "@/lib/shared_state/useSharedState";
import WorkspaceFolder, { Folder } from "@/state/runbooks/workspace_folders";
import TreeView, { SortBy, TreeRowData } from "./TreeView";
import { useEffect, useMemo, useRef, useState } from "react";
import Operation, {
  createFolder,
  deleteFolder,
  moveItems,
  updateFolderName,
} from "@/state/runbooks/operation";
import { uuidv7 } from "uuidv7";
import { NodeApi, TreeApi } from "react-arborist";
import { useQuery } from "@tanstack/react-query";
import { runbooksByWorkspaceId } from "@/lib/queries/runbooks";
import Runbook from "@/state/runbooks/runbook";
import { useStore } from "@/state/store";
import { createFolderMenu, createRunbookMenu, createWorkspaceMenu } from "./menus";
import { cn, usePrevious } from "@/lib/utils";
import { DialogBuilder } from "@/components/Dialogs/dialog";

interface WorkspaceProps {
  workspace: Workspace;
  focused: boolean;
  sortBy: SortBy;
  currentRunbookId: string | null;
  onActivateRunbook: (runbookId: string) => void;
  onStartCreateRunbook: (workspaceId: string, parentFolderId: string | null) => void;
  onStartDeleteRunbook: (workspaceId: string, runbookId: string) => void;
}

export default function WorkspaceComponent(props: WorkspaceProps) {
  const treeRef = useRef<TreeApi<TreeRowData> | null>(null);

  const { data: runbooks } = useQuery(runbooksByWorkspaceId(props.workspace.get("id")!));
  const runbooksById = useMemo(() => {
    return runbooks?.reduce((acc, runbook) => {
      acc[runbook.id] = runbook;
      return acc;
    }, {} as Record<string, Runbook>);
  }, [runbooks]);
  const [folderState, updateFolderState] = useSharedState<Folder>(
    `workspace-folder:${props.workspace.get("id")}`,
  );

  const currentRunbookId = useStore((state) => state.currentRunbookId);
  const [currentItemId, setCurrentItemId] = useState<string | null>(currentRunbookId);
  const lastRunbookId = usePrevious(currentRunbookId);
  const currentWorkspaceId = useStore((state) => state.currentWorkspaceId);
  const setCurrentWorkspaceId = useStore((state) => state.setCurrentWorkspaceId);

  const workspaceFolder = useMemo(() => {
    return WorkspaceFolder.fromJS(folderState);
  }, [folderState]);

  const arboristData = useMemo(() => {
    return workspaceFolder.toArborist();
  }, [workspaceFolder]);

  useEffect(() => {
    // If the current runbook ID changes and we have the previously runbook selected, update the selection.
    // Otherwise, keep the selection the same.
    if (!treeRef.current) return;

    const selection = [...treeRef.current!.selectedIds];
    if (selection.length === 0 || (selection.length === 1 && selection[0] === lastRunbookId)) {
      setCurrentItemId(currentRunbookId);
    }
  }, [currentRunbookId, lastRunbookId]);

  function focusWorkspace() {
    setCurrentWorkspaceId(props.workspace.get("id")!);
  }

  async function handleActivateItem(itemId: string) {
    setCurrentItemId(itemId);
    const node = treeRef.current!.get(itemId);

    if (node?.data.type === "runbook") {
      props.onActivateRunbook(itemId);
    }
  }

  async function handleNewRunbook(parentFolderId: string | null) {
    props.onStartCreateRunbook(props.workspace.get("id")!, parentFolderId);
  }

  async function handleRenameFolder(folderId: string, newName: string) {
    const changeRef = await updateFolderState((state, cancel) => {
      const workspaceFolder = WorkspaceFolder.fromJS(state);
      const success = workspaceFolder.renameFolder(folderId, newName);

      if (!success) {
        cancel();
        return;
      }
      return workspaceFolder.toJS();
    });

    if (changeRef) {
      await Operation.create(
        updateFolderName(props.workspace.get("id")!, folderId, newName, changeRef),
      );
    }
  }

  async function handleNewFolder(parentId: string | null) {
    const id = uuidv7();

    const changeRef = await updateFolderState((state, cancel) => {
      const workspaceFolder = WorkspaceFolder.fromJS(state);
      const success = workspaceFolder.createFolder(id, "New Folder", parentId);

      if (!success) {
        cancel();
        return;
      }

      return workspaceFolder.toJS();
    });

    if (changeRef) {
      await Operation.create(
        createFolder(props.workspace.get("id")!, parentId, id, "New Folder", changeRef),
      );

      let node: NodeApi<TreeRowData> | null = null;
      while (!node) {
        node = treeRef.current!.get(id);
        if (!node) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      node.edit();
    }
  }

  async function onStartDeleteFolder(folderId: string) {
    const workspaceFolder = WorkspaceFolder.fromJS(folderState);
    const node = treeRef.current!.get(folderId);
    const folderName = node?.data.name;
    const descendants = workspaceFolder.getDescendants(folderId);
    const descendantsCount = descendants.reduce(
      (acc, child) => {
        if (child.getData().unwrap().type === "folder") {
          acc.folders++;
        } else {
          acc.runbooks++;
        }

        return acc;
      },
      { folders: 0, runbooks: 0 },
    );

    const totalDescendants = descendantsCount.folders + descendantsCount.runbooks;

    if (totalDescendants > 0) {
      let countSnippet: React.ReactNode | null = null;
      if (descendantsCount.folders === 0 && descendantsCount.runbooks > 0) {
        countSnippet = (
          <strong className="text-danger">
            {descendantsCount.runbooks} {descendantsCount.runbooks === 1 ? "runbook" : "runbooks"}
          </strong>
        );
      } else if (descendantsCount.folders > 0 && descendantsCount.runbooks === 0) {
        countSnippet = (
          <strong className="text-danger">
            {descendantsCount.folders} {descendantsCount.folders === 1 ? "subfolder" : "subfolders"}
          </strong>
        );
      } else if (descendantsCount.folders > 0 && descendantsCount.runbooks > 0) {
        countSnippet = (
          <>
            <strong className="text-danger">
              {descendantsCount.folders}{" "}
              {descendantsCount.folders === 1 ? "subfolder" : "subfolders"}
            </strong>{" "}
            and{" "}
            <strong className="text-danger">
              {descendantsCount.runbooks} {descendantsCount.runbooks === 1 ? "runbook" : "runbooks"}
            </strong>
          </>
        );
      }

      const message = (
        <div>
          <p>
            Are you sure you want to delete the folder <b>{folderName}</b>?
          </p>
          {countSnippet && <p>This will delete {countSnippet}.</p>}
        </div>
      );

      const confirm = await new DialogBuilder<"yes" | "no">()
        .title(`Delete "${folderName}"?`)
        .icon("warning")
        .message(message)
        .action({ label: "Cancel", value: "no", variant: "flat" })
        .action({
          label: "Delete",
          value: "yes",
          color: "danger",
          confirmWith:
            totalDescendants > 0
              ? `Confirm Deleting ${totalDescendants} ${totalDescendants === 1 ? "Item" : "Items"}`
              : undefined,
        })
        .build();

      if (confirm === "yes") {
        handleDeleteFolder(folderId);
      }
    } else {
      handleDeleteFolder(folderId);
    }
  }

  async function handleDeleteFolder(folderId: string) {
    const workspaceFolder = WorkspaceFolder.fromJS(folderState);
    const descendants = workspaceFolder.getDescendants(folderId);
    const runbookIdsToDelete = descendants
      .filter((child) => child.getData().unwrap().type === "runbook")
      .map((child) => child.getData().unwrap().id);

    const promises = runbookIdsToDelete.map(async (runbookId) => {
      const runbook = await Runbook.load(runbookId);
      if (runbook) {
        return runbook.delete();
      } else {
        return Promise.resolve();
      }
    });

    await Promise.allSettled(promises);

    const changeRef = await updateFolderState((state, cancel) => {
      const workspaceFolder = WorkspaceFolder.fromJS(state);
      const success = workspaceFolder.deleteFolder(folderId);
      if (!success) {
        cancel();
        return;
      }

      return workspaceFolder.toJS();
    });

    if (changeRef) {
      await Operation.create(deleteFolder(props.workspace.get("id")!, folderId, changeRef));
    }
  }

  async function handleMoveItems(ids: string[], parentId: string | null, index: number) {
    const changeRef = await updateFolderState((state, cancel) => {
      const workspaceFolder = WorkspaceFolder.fromJS(state);
      const success = workspaceFolder.moveItems(ids, parentId, index);
      if (!success) {
        cancel();
        return;
      }

      return workspaceFolder.toJS();
    });

    if (changeRef) {
      await Operation.create(
        moveItems(props.workspace.get("id")!, ids, parentId, index, changeRef),
      );
    }
  }

  async function handleContextMenu(evt: React.MouseEvent<HTMLDivElement>, itemId: string) {
    evt.preventDefault();
    evt.stopPropagation();

    // If only one item is selected, we show the menu for the item that was right clicked.
    // If multiple items are selected, we show the menu for the whole selection, no matter which node was right clicked.
    const selectedNodes = treeRef.current!.selectedNodes;
    if (selectedNodes.length <= 1) {
      const node = treeRef.current!.get(itemId);
      if (node?.data.type === "folder") {
        const menu = await createFolderMenu({
          onNewFolder: () => handleNewFolder(node.data.id),
          onRenameFolder: () => node.edit(),
          onDeleteFolder: () => onStartDeleteFolder(node.data.id),
          onNewRunbook: () => handleNewRunbook(node.data.id),
        });
        await menu.popup();
        menu.close();
      } else if (node?.data.type === "runbook") {
        const menu = await createRunbookMenu({
          onDeleteRunbook: () =>
            props.onStartDeleteRunbook(props.workspace.get("id")!, node.data.id),
        });
        await menu.popup();
        menu.close();
      }
    }
  }

  const handleBaseContextMenu = async (evt: React.MouseEvent<HTMLDivElement>) => {
    evt.preventDefault();
    const menu = await createWorkspaceMenu({
      onNewFolder: () => {
        handleNewFolder(null);
      },
      onNewRunbook: () => {
        handleNewRunbook(null);
      },
      onNewWorkspace: () => {
        // handleNewWorkspace();
      },
      onRenameWorkspace: () => {
        // handleRenameWorkspace();
      },
    });

    await menu.popup();
    menu.close();
  };

  if (!runbooksById) {
    return <div>Loading...</div>;
  }

  return (
    <div
      className={cn("border rounded-md", {
        "border-1 border-blue-500": currentWorkspaceId === props.workspace.get("id"),
      })}
      onClick={focusWorkspace}
      onContextMenu={handleBaseContextMenu}
    >
      <div className="p-1 mb-2 bg-muted text-sm font-semibold whitespace-nowrap text-ellipsis overflow-x-hidden rounded-t-md">
        {props.workspace.get("name")}
      </div>
      <TreeView
        onTreeApiReady={(api) => (treeRef.current = api)}
        data={arboristData as any}
        sortBy={props.sortBy}
        runbooksById={runbooksById}
        selectedItemId={currentItemId}
        onActivateItem={handleActivateItem}
        onRenameFolder={handleRenameFolder}
        onNewFolder={handleNewFolder}
        onMoveItems={handleMoveItems}
        onContextMenu={handleContextMenu}
      />
    </div>
  );
}
