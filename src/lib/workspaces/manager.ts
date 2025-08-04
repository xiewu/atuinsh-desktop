import Workspace from "@/state/runbooks/workspace";
import { SharedStateManager } from "../shared_state/manager";
import { AtuinSharedStateAdapter } from "../shared_state/adapter";

interface WorkspaceInfo {
  id: string;
  name: string;
  root: string;
  runbooks: Record<string, WorkspaceRunbook>;
}

interface WorkspaceRunbook {
  id: string;
  name: string;
  version: number;
  path: string;
  hash: string;
  lastmod: Date | null;
}

export default class WorkspaceManager {
  private static instance: WorkspaceManager;
  private workspaces: Map<string, WorkspaceInfo> = new Map();

  private constructor() {
    //
  }

  public static getInstance(): WorkspaceManager {
    if (!WorkspaceManager.instance) {
      WorkspaceManager.instance = new WorkspaceManager();
    }
    return WorkspaceManager.instance;
  }

  public async watchWorkspace(workspace: Workspace) {
    if (workspace.isOnline()) {
      SharedStateManager.startInstance(
        `workspace-folder:${workspace.get("id")}`,
        new AtuinSharedStateAdapter(`workspace-folder:${workspace.get("id")}`),
      );
    } else {
      if (this.workspaces.has(workspace.get("id")!)) {
        throw new Error("Workspace already being watched");
      }
    }
  }

  public async unwatchWorkspace(workspace: Workspace) {
    if (workspace.isOnline()) {
      SharedStateManager.stopInstance(`workspace-folder:${workspace.get("id")}`);
    } else {
      if (!this.workspaces.has(workspace.get("id")!)) {
        throw new Error("Workspace not being watched");
      }
    }
  }
}
