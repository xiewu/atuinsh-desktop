import OnlineStrategy from "./online_strategy";
import OfflineStrategy from "./offline_strategy";
import Workspace from "@/state/runbooks/workspace";
import { Result } from "@binarymuse/ts-stdlib";
import Runbook from "@/state/runbooks/runbook";

export default interface WorkspaceStrategy {
  createWorkspace(unsavedWorkspace: Workspace): Promise<Result<Workspace, string>>;
  createRunbook(
    workspaceId: string,
    parentFolderId: string | null,
  ): Promise<Result<Runbook, string>>;
  renameWorkspace(workspace: Workspace, newName: string): Promise<Result<undefined, string>>;
  deleteWorkspace(id: string): Promise<void>;
}

export function getWorkspaceStrategy(workspace: Workspace): WorkspaceStrategy {
  if (workspace.isOnline()) {
    return new OnlineStrategy();
  } else {
    return new OfflineStrategy();
  }
}
