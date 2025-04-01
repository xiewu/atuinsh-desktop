import { usernameFromNwo } from "@/lib/utils";
import { RemoteRunbook } from "../models";
import Operation, { OperationData } from "./operation";
import * as api from "@/api/api";
import { useStore } from "../store";
import Logger from "@/lib/logger";
import { Folder } from "./workspace_folders";
import { ChangeRef } from "@/lib/shared_state/types";
import { ConnectionState } from "../store/user_state";
import AsyncSingleton from "@/lib/async_singleton";
const logger = new Logger("OperationProcessor", "DarkOliveGreen", "GreenYellow");

function assertUnreachable(_x: never): never {
  throw new Error("Unreachable clause");
}

function isOnline() {
  return useStore.getState().connectionState === ConnectionState.Online;
}

const runOperationProcessor = new AsyncSingleton(doProcessUnprocessedOperations);
export const processUnprocessedOperations = () => {
  return runOperationProcessor.run();
};

async function doProcessUnprocessedOperations(): Promise<void> {
  if (!isOnline()) {
    return;
  }

  const ops = await Operation.getUnprocessed();

  if (ops.length > 0) {
    logger.info(`Processing ${ops.length} operations from the operations log`);
  }

  for (const op of ops) {
    // Shut down if we've gone offline mid-run
    if (!isOnline()) {
      return;
    }

    let success = false;
    try {
      success = await processOperation(op);
    } catch (err) {
      continue;
    }

    if (success) {
      op.set("processedAt", new Date());
      await op.save();
    }
  }

  logger.info(`Finished processing operations`);
}

let lastConnectionState: ConnectionState | null = null;
export function startup() {
  useStore.subscribe(
    (state) => state.connectionState,
    (connectionState) => {
      if (connectionState !== lastConnectionState) {
        lastConnectionState = connectionState;
      }

      if (connectionState === ConnectionState.Online) {
        processUnprocessedOperations();
      }
    },
    {
      fireImmediately: true,
    },
  );
}

export function processOperation(op: Operation): Promise<boolean> {
  const details = op.get("operation") as OperationData;

  switch (details.type) {
    case "runbook_deleted": {
      return processRunbookDeleted(details.runbookId);
    }
    case "snapshot_deleted": {
      return processSnapshotDeleted(details.snapshotId);
    }
    case "workspace_created_default": {
      return processWorkspaceCreatedDefault(details.workspaceId);
    }
    case "workspace_initial_folder_layout": {
      return processWorkspaceInitialFolderLayout(
        details.workspaceId,
        details.data,
        details.changeRef,
      );
    }
    case "workspace_created": {
      return processWorkspaceCreated(
        details.workspaceId,
        details.workspaceName,
        details.workspaceOwner,
      );
    }
    case "workspace_folder_renamed": {
      return processWorkspaceFolderRenamed(
        details.workspaceId,
        details.folderId,
        details.newName,
        details.changeRef,
      );
    }
    case "workspace_folder_created": {
      return processWorkspaceFolderCreated(
        details.workspaceId,
        details.parentId,
        details.folderId,
        details.name,
        details.changeRef,
      );
    }
    case "workspace_folder_deleted": {
      return processWorkspaceFolderDeleted(
        details.workspaceId,
        details.folderId,
        details.changeRef,
      );
    }
    case "workspace_items_moved": {
      return processWorkspaceItemsMoved(
        details.workspaceId,
        details.ids,
        details.parentId,
        details.index,
        details.changeRef,
      );
    }
    case "workspace_folder_moved": {
      // legacy version of workspace_items_moved
      return processWorkspaceItemsMoved(
        details.workspaceId,
        details.ids,
        details.parentId,
        details.index,
        details.changeRef,
      );
    }
    case "workspace_runbook_created": {
      return processWorkspaceRunbookCreated(
        details.workspaceId,
        details.parentId,
        details.runbookId,
        details.changeRef,
      );
    }
    case "workspace_runbook_deleted": {
      return processWorkspaceRunbookDeleted(
        details.workspaceId,
        details.runbookId,
        details.changeRef,
      );
    }
    case "workspace_import_runbooks": {
      return processWorkspaceImportRunbooks(
        details.workspaceId,
        details.runbookIds,
        details.parentFolderId,
        details.changeRef,
      );
    }
  }
  // Ensure all possible operation types are checked
  return assertUnreachable(details);
}

async function processRunbookDeleted(runbookId: string): Promise<boolean> {
  let remoteRunbook: RemoteRunbook | null = null;
  try {
    remoteRunbook = await api.getRunbookID(runbookId);
  } catch (err) {
    if (err instanceof api.HttpResponseError && err.code === 404) {
      // No runbook exists on the remote. In this case, there's nothing to process
      return true;
    } else {
      // Looks like we're offline
      return false;
    }
  }

  const isOwner = usernameFromNwo(remoteRunbook.nwo) === useStore.getState().user.username;
  const isCollaborator = !isOwner && remoteRunbook.permissions.includes("update_content");

  if (isOwner) {
    await api.deleteRunbook(runbookId);
    return true;
  } else if (isCollaborator) {
    const collab = await api.getCollaborationForRunbook(runbookId);
    if (!collab) return true;

    await api.deleteCollaboration(collab.id);
    return true;
  } else {
    return true;
  }
}

async function processSnapshotDeleted(snapshotId: string): Promise<boolean> {
  await api.deleteSnapshot(snapshotId);
  return true;
}

async function processWorkspaceCreated(
  workspaceId: string,
  workspaceName: string,
  workspaceOwner: { type: "user" } | { type: "org"; orgId: string },
): Promise<boolean> {
  try {
    if (workspaceOwner.type === "user") {
      await api.createUserWorkspace(workspaceId, workspaceName);
    } else if (workspaceOwner.type === "org") {
      await api.createOrgWorkspace(workspaceId, workspaceName, workspaceOwner.orgId);
    } else {
      throw new Error("Invalid workspace owner");
    }

    return true;
  } catch (err) {
    if (err instanceof api.HttpResponseError) {
      console.error("Failed to create workspace:", err);
      return true;
    } else {
      // Appears as though we're offline
      return false;
    }
  }
}

async function processWorkspaceCreatedDefault(workspaceId: string): Promise<boolean> {
  try {
    await api.updateDefaultWorkspace(workspaceId);
    return true;
  } catch (err) {
    if (err instanceof api.HttpResponseError) {
      console.error("Failed to update default workspace ID:", err);
      return false;
    } else {
      // Appears as though we're offline
      return false;
    }
  }
}

async function processWorkspaceInitialFolderLayout(
  workspaceId: string,
  data: Folder,
  changeRef: ChangeRef,
): Promise<boolean> {
  try {
    await api.updateFolder(workspaceId, { type: "initial_layout", data, changeRef });
    return true;
  } catch (err) {
    if (err instanceof api.HttpResponseError) {
      console.error("Failed to update folder layout:", err);
      return false;
    } else {
      // Appears as though we're offline
      return false;
    }
  }
}

async function processWorkspaceFolderRenamed(
  workspaceId: string,
  folderId: string,
  newName: string,
  changeRef: ChangeRef,
): Promise<boolean> {
  try {
    await api.updateFolder(workspaceId, { type: "folder_renamed", folderId, newName, changeRef });
    return true;
  } catch (err) {
    if (err instanceof api.HttpResponseError) {
      console.error("Failed to rename folder:", err);
      return true;
    } else {
      // Appears as though we're offline
      return false;
    }
  }
}

async function processWorkspaceFolderCreated(
  workspaceId: string,
  parentId: string | null,
  folderId: string,
  name: string,
  changeRef: ChangeRef,
): Promise<boolean> {
  try {
    await api.updateFolder(workspaceId, {
      type: "folder_created",
      parentId,
      folderId,
      name,
      changeRef,
    });
    return true;
  } catch (err) {
    if (err instanceof api.HttpResponseError) {
      console.error("Failed to create folder:", err);
      return true;
    } else {
      // Appears as though we're offline
      return false;
    }
  }
}

async function processWorkspaceFolderDeleted(
  workspaceId: string,
  folderId: string,
  changeRef: ChangeRef,
): Promise<boolean> {
  try {
    await api.updateFolder(workspaceId, { type: "folder_deleted", folderId, changeRef });
    return true;
  } catch (err) {
    if (err instanceof api.HttpResponseError) {
      console.error("Failed to delete folder:", err);
      return true;
    } else {
      // Appears as though we're offline
      return false;
    }
  }
}

async function processWorkspaceItemsMoved(
  workspaceId: string,
  ids: string[],
  parentId: string | null,
  index: number,
  changeRef: ChangeRef,
): Promise<boolean> {
  try {
    await api.updateFolder(workspaceId, { type: "items_moved", ids, parentId, index, changeRef });
    return true;
  } catch (err) {
    if (err instanceof api.HttpResponseError) {
      console.error("Failed to move items:", err);
      return true;
    } else {
      // Appears as though we're offline
      return false;
    }
  }
}

async function processWorkspaceRunbookCreated(
  workspaceId: string,
  parentId: string | null,
  runbookId: string,
  changeRef: ChangeRef,
): Promise<boolean> {
  try {
    await api.updateFolder(workspaceId, {
      type: "runbook_created",
      parentId,
      runbookId,
      changeRef,
    });
    return true;
  } catch (err) {
    if (err instanceof api.HttpResponseError) {
      console.error("Failed to create runbook:", err);
      return true;
    } else {
      // Appears as though we're offline
      return false;
    }
  }
}

async function processWorkspaceRunbookDeleted(
  workspaceId: string,
  runbookId: string,
  changeRef: ChangeRef,
): Promise<boolean> {
  try {
    await api.updateFolder(workspaceId, {
      type: "runbook_deleted",
      runbookId,
      changeRef,
    });
    return true;
  } catch (err) {
    if (err instanceof api.HttpResponseError) {
      console.error("Failed to create runbook:", err);
      return true;
    } else {
      // Appears as though we're offline
      return false;
    }
  }
}

async function processWorkspaceImportRunbooks(
  workspaceId: string,
  runbookIds: string[],
  parentId: string | null,
  changeRef: ChangeRef,
): Promise<boolean> {
  try {
    await api.updateFolder(workspaceId, {
      type: "import_runbooks",
      runbookIds,
      parentId,
      changeRef,
    });
    return true;
  } catch (err) {
    if (err instanceof api.HttpResponseError) {
      console.error("Failed to import runbooks:", err);
      return false;
    } else {
      // Appears as though we're offline
      return false;
    }
  }
}
