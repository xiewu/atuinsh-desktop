import { ChangeRef } from "@/lib/shared_state/types";
import { Folder } from "@/state/runbooks/workspace_folders";
import { get, post, put } from "./api";

export type WorkspacePermission = "create" | "read" | "update" | "manage_runbooks" | "delete";

export interface WorkspaceOwner {
  id: string;
  username: string;
  type: "user" | "org";
}

export interface ServerWorkspace {
  id: string;
  name: string;
  owner: WorkspaceOwner;
  permissions: WorkspacePermission[];
}

export interface WorkspaceIndexResponse {
  workspaces: ServerWorkspace[];
}

export async function getWorkspaces(): Promise<ServerWorkspace[]> {
  const { workspaces } = await get<WorkspaceIndexResponse>("/workspaces");
  return workspaces;
}

export function createUserWorkspace(id: string, name: string) {
  return post("/workspaces", {
    workspace: {
      id: id,
      name: name,
      type: "user",
    },
  });
}

export function createOrgWorkspace(id: string, name: string, orgId: string) {
  return post("/workspaces", {
    workspace: {
      id: id,
      name: name,
      type: "org",
      org_id: orgId,
    },
  });
}

export function updateDefaultWorkspace(newId: string) {
  return put("/workspaces", { id: newId });
}

export type WorkspaceFolderOperation =
  | {
      type: "initial_layout";
      data: Folder;
      changeRef: ChangeRef;
    }
  | {
      type: "folder_renamed";
      folderId: string;
      newName: string;
      changeRef: ChangeRef;
    }
  | {
      type: "folder_created";
      parentId: string | null;
      folderId: string;
      name: string;
      changeRef: ChangeRef;
    }
  | {
      type: "folder_deleted";
      folderId: string;
      changeRef: ChangeRef;
    }
  | {
      type: "items_moved";
      ids: string[];
      parentId: string | null;
      index: number;
      changeRef: ChangeRef;
    }
  | {
      type: "runbook_created";
      parentId: string | null;
      runbookId: string;
      changeRef: ChangeRef;
    }
  | {
      type: "runbook_deleted";
      runbookId: string;
      changeRef: ChangeRef;
    }
  | {
      type: "import_runbooks";
      runbookIds: string[];
      parentId: string | null;
      changeRef: ChangeRef;
    };

export function updateFolder(workspaceId: string, operation: WorkspaceFolderOperation) {
  return put(`/workspaces/${workspaceId}/folder`, {
    op: operation,
  });
}
