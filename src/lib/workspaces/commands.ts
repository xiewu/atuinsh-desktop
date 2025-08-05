import Workspace from "@/state/runbooks/workspace";
import { Err, Ok, Result } from "@binarymuse/ts-stdlib";
import { Channel, invoke } from "@tauri-apps/api/core";

import type { WorkspaceEvent } from "@rust/WorkspaceEvent";

// This type was created based on observations of events sent to
// the frontend from the backend. There may be more events that
// we don't represent here, but these seem to be the most relevant
// ones. Note that there is an "attrs" field that always seems to be
// empty, so is not included here.
//
// See: https://docs.rs/notify/latest/notify/struct.Event.html
//
// TODO: should we include "any" and "other" in all the cases??
export type FsEvent =
  | {
      type: "create";
      kind: "file" | "folder";
      paths: [string];
    }
  | {
      type: "modify";
      kind: "rename";
      mode: "both";
      paths: [string, string];
    }
  | {
      type: "modify";
      kind: "rename";
      mode: "any";
      paths: [string];
    }
  | {
      type: "modify";
      kind: "metadata";
      mode: "any" | "metadata" | "extended";
      paths: [string];
    }
  | {
      type: "modify";
      kind: "data";
      mode: "content";
      paths: [string];
    }
  | {
      type: "remove";
      kind: "file" | "folder";
      paths: [string];
    };

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
  return promiseResult<void, string>(invoke("reset_workspaces"));
}

export async function watchWorkspace(
  path: string,
  id: string,
  callback: (event: WorkspaceEvent) => void,
): Promise<() => void> {
  console.log("(coommand) Watching workspace", id);
  const channel = new Channel<WorkspaceEvent>(callback);
  await promiseResult<void, string>(invoke("watch_workspace", { path, id, channel }));
  return () => {
    invoke("unwatch_workspace", { id });
  };
}

export async function createWorkspace(
  path: string,
  id: string,
  name: string,
): Promise<Result<void, string>> {
  return promiseResult<void, string>(invoke("create_workspace", { path, id, name }));
}

export async function renameWorkspace(id: string, name: string): Promise<Result<void, string>> {
  return promiseResult<void, string>(invoke("rename_workspace", { id, name }));
}

export async function deleteWorkspace(id: string): Promise<Result<void, string>> {
  return promiseResult<void, string>(invoke("delete_workspace", { id }));
}

export async function getWorkspaceInfo(
  workspace: Workspace,
): Promise<Result<WorkspaceDirInfo, string>> {
  return promiseResult<WorkspaceDirInfo, string>(
    invoke<WorkspaceDirInfo>("read_dir", { workspaceId: workspace.get("id")! }),
  );
}
