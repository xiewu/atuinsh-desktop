import OnlineStrategy from "./online_strategy";
import OfflineStrategy from "./offline_strategy";
import Workspace from "@/state/runbooks/workspace";
import { Result } from "@binarymuse/ts-stdlib";
import Runbook from "@/state/runbooks/runbook";
import WorkspaceFolder from "@/state/runbooks/workspace_folders";
import { ChangeRef } from "../shared_state/types";
import { OperationData } from "@/state/runbooks/operation";

enum WorkspaceStrategyType {
  Online = "online",
  Offline = "offline",
}

export type DoFolderOp = (
  op: (wsf: WorkspaceFolder, cancel: () => undefined) => boolean,
  operation: (changeRef: ChangeRef) => Option<OperationData>,
) => Promise<boolean>;

export default interface WorkspaceStrategy {
  createWorkspace(unsavedWorkspace: Workspace): Promise<Result<Workspace, string>>;
  createRunbook(
    workspaceId: string,
    parentFolderId: string | null,
  ): Promise<Result<Runbook, string>>;
  renameWorkspace(workspace: Workspace, newName: string): Promise<Result<undefined, string>>;
  deleteWorkspace(id: string): Promise<void>;
  renameFolder(
    doFolderOp: DoFolderOp,
    workspaceId: string,
    folderId: string,
    newName: string,
  ): Promise<Result<undefined, string>>;
}

export function getWorkspaceStrategy(strategy: WorkspaceStrategyType): WorkspaceStrategy;
export function getWorkspaceStrategy(workspace: Workspace): WorkspaceStrategy;
export function getWorkspaceStrategy(
  workspaceOrType: Workspace | WorkspaceStrategyType,
): WorkspaceStrategy {
  let strategy: WorkspaceStrategyType;
  if (typeof workspaceOrType === "string") {
    strategy = workspaceOrType;
  } else {
    strategy = workspaceOrType.isOnline()
      ? WorkspaceStrategyType.Online
      : WorkspaceStrategyType.Offline;
  }

  if (strategy === WorkspaceStrategyType.Online) {
    return new OnlineStrategy();
  } else {
    return new OfflineStrategy();
  }
}
