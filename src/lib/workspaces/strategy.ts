import OnlineStrategy from "./online_strategy";
import OfflineStrategy from "./offline_strategy";
import Workspace from "@/state/runbooks/workspace";
import { Result } from "@binarymuse/ts-stdlib";
import Runbook from "@/state/runbooks/runbook";

enum WorkspaceStrategyType {
  Online = "online",
  Offline = "offline",
}

export default interface WorkspaceStrategy {
  createWorkspace(unsavedWorkspace: Workspace): Promise<Result<Workspace, string>>;
  createRunbook(
    workspaceId: string,
    parentFolderId: string | null,
  ): Promise<Result<Runbook, string>>;
  renameWorkspace(workspace: Workspace, newName: string): Promise<Result<undefined, string>>;
  deleteWorkspace(id: string): Promise<void>;
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
