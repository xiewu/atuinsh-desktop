import Workspace from "@/state/runbooks/workspace";
import { SharedStateManager } from "../shared_state/manager";
import { AtuinSharedStateAdapter } from "../shared_state/adapter";

import type { WorkspaceState } from "@rust/WorkspaceState";
import type { WorkspaceError } from "@rust/WorkspaceError";
import { watchWorkspace } from "./commands";
import { localWorkspaceInfo } from "../queries/workspaces";
import { useStore } from "@/state/store";

export default class WorkspaceManager {
  private static instance: WorkspaceManager;
  private workspaces: Map<string, Result<WorkspaceState, WorkspaceError>> = new Map();

  private constructor() {}

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

      await watchWorkspace(workspace.get("folder")!, workspace.get("id")!, async (event) => {
        console.log("Workspace event", event);
        switch (event.type) {
          case "State":
            this.workspaces.set(workspace.get("id")!, Ok(event.data));
            if (workspace.get("name") !== event.data.name) {
              workspace.set("name", event.data.name);
              await workspace.save();
            }
            useStore
              .getState()
              .queryClient.invalidateQueries(localWorkspaceInfo(workspace.get("id")!));
            break;
          case "Error":
            this.workspaces.set(workspace.get("id")!, Err(event.data));
            useStore
              .getState()
              .queryClient.invalidateQueries(localWorkspaceInfo(workspace.get("id")!));
            break;
          case "OtherMessage":
            console.log("Workspace event", event.data);
            break;
          default:
            const exhaustiveCheck: never = event;
            console.error(exhaustiveCheck);
            throw new Error(`Unhandled workspace event: ${exhaustiveCheck}`);
        }
      });
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

  public getWorkspaceInfo(workspaceId: string): Option<Result<WorkspaceState, WorkspaceError>> {
    return Some(this.workspaces.get(workspaceId));
  }
}
