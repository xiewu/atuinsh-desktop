import { FieldSpecs, GlobalSpec, Model, Persistence } from "ts-tiny-activerecord";
import createTauriAdapter, { setTimestamps } from "@/lib/db/tauri-ar-adapter";
import { DateEncoder, JSONEncoder } from "@/lib/db/encoders";
import { useStore } from "../store";
import { ConnectionState } from "../store/user_state";
import { processUnprocessedOperations } from "./operation_processor";
import { ChangeRef } from "@/lib/shared_state/types";
import { Folder } from "./workspace_folders";

type RunbookOperations = {
  type: "runbook_deleted";
  runbookId: string;
};

type SnapshotOperations = {
  type: "snapshot_deleted";
  snapshotId: string;
};

type WorkspaceOperations =
  | {
      type: "workspace_created_default";
      workspaceId: string;
    }
  | {
      type: "workspace_created";
      workspaceId: string;
      workspaceName: string;
      workspaceOwner: { type: "user" } | { type: "org"; orgId: string };
    }
  | {
      type: "workspace_renamed";
      workspaceId: string;
      newName: string;
    }
  | {
      type: "workspace_deleted";
      workspaceId: string;
    };

type WorkspaceFolderOperations =
  | {
      type: "workspace_initial_folder_layout";
      workspaceId: string;
      changeRef: ChangeRef;
      data: Folder;
    }
  | {
      type: "workspace_folder_created";
      workspaceId: string;
      parentId: string | null;
      folderId: string;
      name: string;
      changeRef: ChangeRef;
    }
  | {
      type: "workspace_folder_renamed";
      workspaceId: string;
      folderId: string;
      newName: string;
      changeRef: ChangeRef;
    }
  | {
      type: "workspace_folder_deleted";
      workspaceId: string;
      folderId: string;
      changeRef: ChangeRef;
    }
  | {
      type: "workspace_items_moved";
      workspaceId: string;
      ids: string[];
      parentId: string | null;
      index: number;
      changeRef: ChangeRef;
    }
  | {
      // legacy version of above
      type: "workspace_folder_moved";
      workspaceId: string;
      ids: string[];
      parentId: string | null;
      index: number;
      changeRef: ChangeRef;
    }
  | {
      type: "workspace_runbook_created";
      workspaceId: string;
      parentId: string | null;
      runbookId: string;
      changeRef: ChangeRef;
    }
  | {
      type: "workspace_runbook_deleted";
      workspaceId: string;
      runbookId: string;
      changeRef: ChangeRef;
    }
  | {
      type: "workspace_import_runbooks";
      workspaceId: string;
      runbookIds: string[];
      parentFolderId: string | null;
      changeRef: ChangeRef;
    }
  | {
      type: "workspace_items_moved_to_new_workspace";
      oldWorkspaceId: string;
      newWorkspaceId: string;
      // need to send the move bundles
      // as well as both change refs
    };

export type OperationData =
  | RunbookOperations
  | SnapshotOperations
  | WorkspaceOperations
  | WorkspaceFolderOperations;

export type OperationAttrs = {
  id?: string;
  operation: OperationData;
  processedAt?: Date | null;
  created?: Date;
  updated?: Date;
};

const adapter = createTauriAdapter<OperationAttrs>({
  dbName: "runbooks",
  tableName: "operation_log",
});

const fieldSpecs: FieldSpecs<OperationAttrs> = {
  operation: { encoder: JSONEncoder },
  processedAt: { encoder: DateEncoder },
  created: { encoder: DateEncoder },
  updated: { encoder: DateEncoder },
};

const globalSpec: GlobalSpec<OperationAttrs> = {
  preSave: setTimestamps,
  postSave: async (_context, _model, type) => {
    if (type === "insert" && useStore.getState().connectionState === ConnectionState.Online) {
      processUnprocessedOperations();
    }
  },
};

@Persistence<OperationAttrs>(adapter, fieldSpecs, globalSpec)
export default class Operation extends Model<OperationAttrs> {
  static async getUnprocessed(): Promise<Operation[]> {
    return Operation.all({ processedAt: null });
  }

  static async create(operation: OperationData): Promise<Operation> {
    const op = new Operation({ operation });
    await op.save();
    return op;
  }
}

export function updateFolderName(
  workspaceId: string,
  folderId: string,
  newName: string,
  changeRef: ChangeRef,
): OperationData {
  return {
    type: "workspace_folder_renamed",
    workspaceId,
    folderId,
    newName,
    changeRef,
  };
}

export function createFolder(
  workspaceId: string,
  parentId: string | null,
  folderId: string,
  name: string,
  changeRef: ChangeRef,
): OperationData {
  return {
    type: "workspace_folder_created",
    workspaceId,
    parentId,
    folderId,
    name,
    changeRef,
  };
}

export function deleteFolder(
  workspaceId: string,
  folderId: string,
  changeRef: ChangeRef,
): OperationData {
  return {
    type: "workspace_folder_deleted",
    workspaceId,
    folderId,
    changeRef,
  };
}

export function moveItems(
  workspaceId: string,
  ids: string[],
  parentId: string | null,
  index: number,
  changeRef: ChangeRef,
): OperationData {
  return {
    type: "workspace_items_moved",
    workspaceId,
    ids,
    parentId,
    index,
    changeRef,
  };
}

export function createRunbook(
  workspaceId: string,
  parentId: string | null,
  runbookId: string,
  changeRef: ChangeRef,
): OperationData {
  return {
    type: "workspace_runbook_created",
    workspaceId,
    parentId,
    runbookId,
    changeRef,
  };
}

export function deleteRunbook(
  workspaceId: string,
  runbookId: string,
  changeRef: ChangeRef,
): OperationData {
  return {
    type: "workspace_runbook_deleted",
    workspaceId,
    runbookId,
    changeRef,
  };
}

export function renameWorkspace(workspaceId: string, newName: string): OperationData {
  return {
    type: "workspace_renamed",
    workspaceId,
    newName,
  };
}

export function createWorkspace(
  workspaceId: string,
  workspaceName: string,
  workspaceOwner: { type: "user" } | { type: "org"; orgId: string },
): OperationData {
  return {
    type: "workspace_created",
    workspaceId,
    workspaceName,
    workspaceOwner,
  };
}
