import { ChangeRef } from "@/lib/shared_state/types";
import { Folder } from "@/state/runbooks/workspace_folders";
import { del, get, post, put } from "./api";

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

export async function getWorkspace(workspaceId: string): Promise<ServerWorkspace | null> {
  const { workspace } = await get<{ workspace: ServerWorkspace }>(`/workspaces/${workspaceId}`);
  return workspace;
}

export function createUserWorkspace(id: string, name: string) {
  return post("/workspaces", {
    type: "user",
    workspace: {
      id: id,
      name: name,
    },
  });
}

export function createOrgWorkspace(id: string, name: string, orgId: string) {
  return post("/workspaces", {
    type: "org",
    org_id: orgId,
    workspace: {
      id: id,
      name: name,
    },
  });
}

export function deleteWorkspace(workspaceId: string) {
  return del(`/workspaces/${workspaceId}`);
}

export function updateDefaultWorkspace(newId: string) {
  return put("/workspaces", { id: newId });
}

type WorkspaceParams = {
  name: string;
};

export function updateWorkspace(workspaceId: string, params: WorkspaceParams) {
  return put(`/workspaces/${workspaceId}`, { workspace: params });
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
    }
  | {
      type: "items_moved_workspaces";
      newWorkspaceId: string;
      targetFolderId: string | null;
      topLevelItems: string[];
      runbooksMovedWithNames: { id: string; name: string }[];
      createChangeRef: ChangeRef;
      deleteChangeRef: ChangeRef;
    };

export function updateFolder(workspaceId: string, operation: WorkspaceFolderOperation) {
  return put(`/workspaces/${workspaceId}/folder`, {
    op: operation,
  });
}
