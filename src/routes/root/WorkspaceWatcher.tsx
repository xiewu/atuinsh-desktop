import WorkspaceManager from "@/lib/workspaces/manager";
import Workspace from "@/state/runbooks/workspace";
import { useEffect } from "react";

interface WorkspaceWatcherProps {
  workspace: Workspace;
}

export default function WorkspaceWatcher({ workspace }: WorkspaceWatcherProps) {
  // TODO: check if any of the following changed:
  // - online
  // - folder
  // and update with the appropriate backend
  // ....
  // maybe this should be handled by the strategy?? e.g. renameWorkspace, updatePath, etc.

  useEffect(() => {
    console.log("Watching workspace", workspace.get("id"));
    const workspaceManager = WorkspaceManager.getInstance();
    workspaceManager.watchWorkspace(workspace);

    return () => {
      workspaceManager.unwatchWorkspace(workspace);
    };
  }, [workspace.get("id")]);

  return null;
}
