import Workspace from "@/state/runbooks/workspace";
import { SharedStateManager } from "../shared_state/manager";
import { AtuinSharedStateAdapter } from "../shared_state/adapter";

import type { WorkspaceState } from "@rust/WorkspaceState";
import { watchWorkspace } from "./commands";
import { localWorkspaceInfo } from "../queries/workspaces";
import { useStore } from "@/state/store";

export default class WorkspaceManager {
  private static instance: WorkspaceManager;
  private workspaces: Map<string, WorkspaceState> = new Map();

  private constructor() {}

  public static getInstance(): WorkspaceManager {
    if (!WorkspaceManager.instance) {
      WorkspaceManager.instance = new WorkspaceManager();
    }
    return WorkspaceManager.instance;
  }

  public async watchWorkspace(workspace: Workspace) {
    console.log(
      "Requesting to watch workspace",
      workspace.get("id"),
      workspace,
      workspace.isOnline(),
    );

    if (workspace.isOnline()) {
      console.log("Starting shared state manager for workspace", workspace.get("id"));
      SharedStateManager.startInstance(
        `workspace-folder:${workspace.get("id")}`,
        new AtuinSharedStateAdapter(`workspace-folder:${workspace.get("id")}`),
      );
    } else {
      if (this.workspaces.has(workspace.get("id")!)) {
        throw new Error("Workspace already being watched");
      }

      await watchWorkspace(workspace.get("folder")!, workspace.get("id")!, (event) => {
        console.log("Workspace event", event);
        switch (event.type) {
          case "InitialState":
            this.workspaces.set(workspace.get("id")!, event.data);
            useStore
              .getState()
              .queryClient.invalidateQueries(localWorkspaceInfo(workspace.get("id")!));
            break;
          case "OtherMessage":
            console.log("Workspace event", event.data);
            break;
          default:
            const exhaustiveCheck: never = event;
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

  public getWorkspaceInfo(workspaceId: string): WorkspaceState | undefined {
    return this.workspaces.get(workspaceId);
  }
}
