import Workspace from "@/state/runbooks/workspace";
import { Err, Ok, Result } from "@binarymuse/ts-stdlib";
import { Channel, invoke } from "@tauri-apps/api/core";

export interface FsEvent {
  //
}

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

export async function resetWorkspaces(): Promise<Result<void, string>> {
  return promiseResult<void, string>(invoke<void>("reset_workspaces"));
}

export async function watchWorkspace(
  path: string,
  id: string,
  callback: (event: FsEvent) => void,
): Promise<() => void> {
  const channel = new Channel<FsEvent>(callback);
  await promiseResult<void, string>(invoke<void>("watch_workspace", { path, id, channel }));
  return () => {
    invoke<void>("unwatch_workspace", { id });
  };
}

export async function createWorkspace(
  path: string,
  id: string,
  name: string,
): Promise<Result<void, string>> {
  return promiseResult<void, string>(invoke<void>("create_workspace", { path, id, name }));
}

export async function renameWorkspace(id: string, name: string): Promise<Result<void, string>> {
  return promiseResult<void, string>(invoke<void>("rename_workspace", { id, name }));
}

export async function deleteWorkspace(id: string): Promise<Result<void, string>> {
  return promiseResult<void, string>(invoke<void>("delete_workspace", { id }));
}

export async function getWorkspaceInfo(
  workspace: Workspace,
): Promise<Result<WorkspaceDirInfo, string>> {
  return promiseResult<WorkspaceDirInfo, string>(
    invoke<WorkspaceDirInfo>("read_dir", { workspaceId: workspace.get("id")! }),
  );
}
