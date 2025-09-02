import Workspace from "@/state/runbooks/workspace";
import { Err, Ok, Result } from "@binarymuse/ts-stdlib";
import { Channel, invoke } from "@tauri-apps/api/core";

import type { WorkspaceEvent } from "@rust/WorkspaceEvent";
import { WorkspaceError } from "@rust/WorkspaceError";
import { RustOfflineRunbook } from "@/rs-bindings/RustOfflineRunbook";

export interface WorkspaceDirInfo {
  id: string;
  name: string;
  path: string;
  contents: DirEntry[];
}

export interface DirEntry {
  name: string;
  is_dir: boolean;
  path: string;
}

async function promiseResult<T, E>(promise: Promise<T>): Promise<Result<T, E>> {
  try {
    const t: T = await promise;
    return Ok(t);
  } catch (e) {
    return Err(e as E);
  }
}

export async function resetWorkspaces(): Promise<Result<undefined, WorkspaceError>> {
  return promiseResult<undefined, WorkspaceError>(invoke("reset_workspaces"));
}

export async function watchWorkspace(
  path: string,
  id: string,
  callback: (event: WorkspaceEvent) => void,
): Promise<() => void> {
  console.log("(coommand) Watching workspace", id);
  const channel = new Channel<WorkspaceEvent>(callback);
  await promiseResult<undefined, WorkspaceError>(invoke("watch_workspace", { path, id, channel }));
  return () => {
    invoke("unwatch_workspace", { id });
  };
}

export async function createWorkspace(
  path: string,
  id: string,
  name: string,
): Promise<Result<undefined, WorkspaceError>> {
  return promiseResult<undefined, WorkspaceError>(invoke("create_workspace", { path, id, name }));
}

export async function renameWorkspace(
  id: string,
  name: string,
): Promise<Result<undefined, WorkspaceError>> {
  return promiseResult<undefined, WorkspaceError>(invoke("rename_workspace", { id, name }));
}

export async function deleteWorkspace(id: string): Promise<Result<undefined, string>> {
  return promiseResult<undefined, string>(invoke("delete_workspace", { id }));
}

export async function getWorkspaceInfo(
  workspace: Workspace,
): Promise<Result<WorkspaceDirInfo, WorkspaceError>> {
  return promiseResult<WorkspaceDirInfo, WorkspaceError>(
    invoke<WorkspaceDirInfo>("read_dir", { workspaceId: workspace.get("id")! }),
  );
}

export async function createFolder(
  workspaceId: string,
  parentId: string | null,
  name: string,
): Promise<Result<string, WorkspaceError>> {
  return promiseResult<string, WorkspaceError>(
    invoke("create_folder", { workspaceId, parentPath: parentId, name }),
  );
}

export async function renameFolder(
  workspaceId: string,
  folderId: string,
  newName: string,
): Promise<Result<undefined, WorkspaceError>> {
  return promiseResult<undefined, WorkspaceError>(
    invoke("rename_folder", { workspaceId, folderId, newName }),
  );
}

export async function deleteFolder(
  workspaceId: string,
  folderId: string,
): Promise<Result<undefined, WorkspaceError>> {
  return promiseResult<undefined, WorkspaceError>(
    invoke("delete_folder", { workspaceId, folderId }),
  );
}

export async function moveItems(
  workspaceId: string,
  ids: string[],
  parentId: string | null,
): Promise<Result<undefined, WorkspaceError>> {
  return promiseResult<undefined, WorkspaceError>(
    invoke("move_items", { workspaceId, itemIds: ids, newParent: parentId }),
  );
}

export async function createRunbook(
  workspaceId: string,
  parentFolderId: string | null,
): Promise<Result<string, WorkspaceError>> {
  return promiseResult<string, WorkspaceError>(
    invoke("create_runbook", { workspaceId, parentFolderId }),
  );
}

export async function deleteRunbook(
  workspaceId: string,
  runbookId: string,
): Promise<Result<undefined, WorkspaceError>> {
  return promiseResult<undefined, WorkspaceError>(
    invoke("delete_runbook", { workspaceId, runbookId }),
  );
}

export async function saveRunbook(
  workspaceId: string,
  runbookId: string,
  name: string,
  content: string,
): Promise<Result<undefined, WorkspaceError>> {
  return promiseResult<undefined, WorkspaceError>(
    invoke("save_runbook", { workspaceId, runbookId, name, content }),
  );
}

export async function getRunbook(
  runbookId: string,
): Promise<Result<RustOfflineRunbook, WorkspaceError>> {
  return promiseResult<RustOfflineRunbook, WorkspaceError>(invoke("get_runbook", { runbookId }));
}
