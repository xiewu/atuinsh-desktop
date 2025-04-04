import Workspace from "@/state/runbooks/workspace";
import useWorkspaceFolder from "@/lib/hooks/useWorkspaceFolder";
import TreeView, { SortBy, TreeRowData } from "./TreeView";
import { JSX, useEffect, useMemo, useReducer, useRef, useState } from "react";
import Operation, {
  createFolder,
  deleteFolder,
  moveItems,
  renameWorkspace,
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
import InlineInput from "./TreeView/InlineInput";

interface WorkspaceProps {
  workspace: Workspace;
  focused: boolean;
  sortBy: SortBy;
  currentRunbookId: string | null;
  onActivateRunbook: (runbookId: string) => void;
  onStartCreateRunbook: (workspaceId: string, parentFolderId: string | null) => void;
  onStartCreateWorkspace: () => void;
  onStartDeleteRunbook: (workspaceId: string, runbookId: string) => void;
}

type WorkspaceRenameAction =
  | {
      type: "start_rename";
      currentName: string;
    }
  | {
      type: "cancel_rename";
    }
  | {
      type: "confirm_rename";
      newName: string;
    };

type WorkspaceRenameState = {
  isEditing: boolean;
  newName: string;
};

function workspaceNameReducer(
  state: WorkspaceRenameState,
  action: WorkspaceRenameAction,
): WorkspaceRenameState {
  switch (action.type) {
    case "start_rename":
      return {
        ...state,
        isEditing: true,
        newName: action.currentName,
      };
    case "cancel_rename":
      return {
        ...state,
        isEditing: false,
      };
    case "confirm_rename":
      return {
        ...state,
        isEditing: false,
        newName: action.newName,
      };
  }
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

  const currentRunbookId = useStore((state) => state.currentRunbookId);
  const lastRunbookId = usePrevious(currentRunbookId);
  const currentWorkspaceId = useStore((state) => state.currentWorkspaceId);
  const setCurrentWorkspaceId = useStore((state) => state.setCurrentWorkspaceId);
  const toggleFolder = useStore((state) => state.toggleFolder);
  const folderState = useStore((state) => state.folderState);
  const [currentItemId, setCurrentItemId] = useState<string | null>(currentRunbookId);
  const [workspaceNameState, dispatchWorkspaceName] = useReducer(workspaceNameReducer, {
    isEditing: false,
    newName: props.workspace.get("name")!,
  });

  const [workspaceFolder, doFolderOp] = useWorkspaceFolder(props.workspace.get("id")!);

  const arboristData = useMemo(() => {
    return workspaceFolder.toArborist();
  }, [workspaceFolder]);

  useEffect(() => {
    // If the current runbook ID changes and we have the previous runbook selected, update the selection.
    // Otherwise, keep the selection the same.
    if (!treeRef.current) return;

    const selection = [...treeRef.current!.selectedIds];
    if (selection.length === 0 || (selection.length === 1 && selection[0] === lastRunbookId)) {
      setCurrentItemId(currentRunbookId);
    }
  }, [currentRunbookId, lastRunbookId]);

  // ***** UTILITIES *****

  function focusWorkspace() {
    setCurrentWorkspaceId(props.workspace.get("id")!);
  }

  function folderInfo(folderId: string | null): {
    node: NodeApi<TreeRowData> | null;
    descendents: {
      nodes: NodeApi<TreeRowData>[];
      folders: number;
      runbooks: number;
      total: number;
    };
  } {
    const node = treeRef.current!.get(folderId);
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

    return {
      node: node,
      descendents: {
        nodes: descendants
          .map((child) => treeRef.current!.get(child.id() as string))
          .filter((item) => !!item),
        folders: descendantsCount.folders,
        runbooks: descendantsCount.runbooks,
        total: descendantsCount.folders + descendantsCount.runbooks,
      },
    };
  }

  // **** HANDLERS *****

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
    doFolderOp(
      (wsf) => wsf.renameFolder(folderId, newName),
      (changeRef) => updateFolderName(props.workspace.get("id")!, folderId, newName, changeRef),
    );
  }

  async function handleNewFolder(parentId: string | null) {
    const id = uuidv7();
    await doFolderOp(
      (wsf) => wsf.createFolder(id, "New Folder", parentId),
      (changeRef) =>
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

  /**
   * If the folder has descendents, prompt the user before deletion.
   */
  async function onStartDeleteFolder(folderId: string) {
    const { node, descendents } = folderInfo(folderId);
    const folderName = node?.data.name;
    const snippet = (
      <span>
        the folder <b>{folderName}</b>
      </span>
    );

    if (descendents.total > 0) {
      const confirm = await confirmDeleteFolder({ node, descendents }, snippet);
      if (confirm === "yes") {
        handleDeleteFolder(folderId);
      }
    } else {
      handleDeleteFolder(folderId);
    }
  }

  async function handleDeleteFolder(folderId: string) {
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

    await doFolderOp(
      (wsf) => wsf.deleteFolder(folderId),
      (changeRef) => deleteFolder(props.workspace.get("id")!, folderId, changeRef),
    );
  }

  async function handleMoveItems(ids: string[], parentId: string | null, index: number) {
    doFolderOp(
      (wsf) => wsf.moveItems(ids, parentId, index),
      (changeRef) => moveItems(props.workspace.get("id")!, ids, parentId, index, changeRef),
    );
  }

  async function handleDeleteWorkspace() {
    const workspace = await Workspace.get(props.workspace.get("id")!);
    if (workspace) {
      await workspace.del();
    }
  }

  async function handleRenameWorkspace(newName: string) {
    dispatchWorkspaceName({ type: "confirm_rename", newName });

    const workspace = await Workspace.get(props.workspace.get("id")!);
    if (workspace) {
      workspace.set("name", newName);
      await workspace.save();
    }

    const op = await Operation.create(renameWorkspace(props.workspace.get("id")!, newName));
    await op.save();
  }

  function handleToggleFolder(nodeId: string) {
    toggleFolder(props.workspace.get("id")!, nodeId);
  }

  // ***** CONTEXT MENUS *****

  async function handleContextMenu(evt: React.MouseEvent<HTMLDivElement>, itemId: string) {
    evt.preventDefault();
    evt.stopPropagation();

    focusWorkspace();

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
    evt.stopPropagation();

    focusWorkspace();

    const menu = await createWorkspaceMenu({
      onNewFolder: () => {
        handleNewFolder(null);
      },
      onNewRunbook: () => {
        handleNewRunbook(null);
      },
      onNewWorkspace: () => {
        props.onStartCreateWorkspace();
      },
      onRenameWorkspace: () => {
        dispatchWorkspaceName({ type: "start_rename", currentName: props.workspace.get("name")! });
      },
      onDeleteWorkspace: async () => {
        const userWorkspaces = await Workspace.all({ orgId: null });
        if (userWorkspaces.length === 1) {
          new DialogBuilder()
            .title("Cannot Delete Last Workspace")
            .message("You must have at least one workspace.")
            .action({ label: "OK", value: "ok" })
            .build();
          return;
        }

        const { node, descendents } = folderInfo(null);
        const snippet = (
          <span>
            the workspace <b>{props.workspace.get("name")}</b>
          </span>
        );

        if (descendents.total > 0) {
          const confirm = await confirmDeleteFolder({ node, descendents }, snippet);
          if (confirm === "yes") {
            handleDeleteWorkspace();
          }
        } else {
          handleDeleteWorkspace();
        }
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
      className={cn("border rounded-md w-full", {
        "border-1 border-blue-500": currentWorkspaceId === props.workspace.get("id"),
      })}
      onClick={focusWorkspace}
      onContextMenu={handleBaseContextMenu}
    >
      {workspaceNameState.isEditing ? (
        <div className="p-1 mb-2">
          <InlineInput
            value={workspaceNameState.newName}
            onSubmit={handleRenameWorkspace}
            onCancel={() => dispatchWorkspaceName({ type: "cancel_rename" })}
          />
        </div>
      ) : (
        <div className="p-1 mb-2 bg-muted text-sm font-semibold whitespace-nowrap text-ellipsis overflow-x-hidden rounded-t-md">
          {props.workspace.get("name")}
        </div>
      )}
      <TreeView
        onTreeApiReady={(api) => (treeRef.current = api)}
        data={arboristData as any}
        sortBy={props.sortBy}
        runbooksById={runbooksById}
        selectedItemId={currentItemId}
        initialOpenState={folderState[props.workspace.get("id")!] || {}}
        onActivateItem={handleActivateItem}
        onRenameFolder={handleRenameFolder}
        onNewFolder={handleNewFolder}
        onMoveItems={handleMoveItems}
        onContextMenu={handleContextMenu}
        onToggleFolder={handleToggleFolder}
      />
    </div>
  );
}

async function confirmDeleteFolder(
  info: {
    node: NodeApi<TreeRowData> | null;
    descendents: {
      folders: number;
      runbooks: number;
      total: number;
    };
  },
  idSnippet: JSX.Element,
): Promise<"yes" | "no"> {
  const { descendents } = info;

  let countSnippet: React.ReactNode | null = null;
  if (descendents.folders === 0 && descendents.runbooks > 0) {
    countSnippet = (
      <strong className="text-danger">
        {descendents.runbooks} {descendents.runbooks === 1 ? "runbook" : "runbooks"}
      </strong>
    );
  } else if (descendents.folders > 0 && descendents.runbooks === 0) {
    countSnippet = (
      <strong className="text-danger">
        {descendents.folders} {descendents.folders === 1 ? "subfolder" : "subfolders"}
      </strong>
    );
  } else if (descendents.folders > 0 && descendents.runbooks > 0) {
    countSnippet = (
      <>
        <strong className="text-danger">
          {descendents.folders} {descendents.folders === 1 ? "subfolder" : "subfolders"}
        </strong>{" "}
        and{" "}
        <strong className="text-danger">
          {descendents.runbooks} {descendents.runbooks === 1 ? "runbook" : "runbooks"}
        </strong>
      </>
    );
  }

  const message = (
    <div>
      <p>Are you sure you want to delete the folder {idSnippet}?</p>
      {countSnippet && <p>This will delete {countSnippet}.</p>}
    </div>
  );

  return new DialogBuilder<"yes" | "no">()
    .title(`Confirm Deletion`)
    .icon("warning")
    .message(message)
    .action({ label: "Cancel", value: "no", variant: "flat" })
    .action({
      label: "Delete",
      value: "yes",
      color: "danger",
      confirmWith:
        descendents.total > 0
          ? `Confirm Deleting ${descendents.total} ${descendents.total === 1 ? "Item" : "Items"}`
          : undefined,
    })
    .build();
}
