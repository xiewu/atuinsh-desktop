import Workspace from "@/state/runbooks/workspace";
import { SharedStateManager } from "../shared_state/manager";
import { AtuinSharedStateAdapter } from "../shared_state/adapter";
import type { WorkspaceState } from "@rust/WorkspaceState";
import type { WorkspaceError } from "@rust/WorkspaceError";
import { watchWorkspace } from "./commands";
import { localWorkspaceInfo } from "../queries/workspaces";
import { useStore } from "@/state/store";
import { allRunbookIds, allRunbooks, runbookById } from "../queries/runbooks";
import { invoke } from "@tauri-apps/api/core";
import { SET_RUNBOOK_TAG } from "@/state/store/runbook_state";
import Emittery from "emittery";
import { OfflineRunbook } from "@/state/runbooks/runbook";

export default class WorkspaceManager {
  private static instance: WorkspaceManager;
  private workspaces: Map<string, Result<WorkspaceState, WorkspaceError>> = new Map();
  private emitter: Emittery;

  private constructor() {
    this.emitter = new Emittery();
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

      await watchWorkspace(workspace.get("folder")!, workspace.get("id")!, async (event) => {
        const queryClient = useStore.getState().queryClient;
        switch (event.type) {
          case "State":
            this.workspaces.set(workspace.get("id")!, Ok(event.data));
            if (workspace.get("name") !== event.data.name) {
              workspace.set("name", event.data.name);
              await workspace.save();
            }
            queryClient.invalidateQueries(localWorkspaceInfo(workspace.get("id")!));
            queryClient.invalidateQueries(allRunbookIds());
            queryClient.invalidateQueries(allRunbooks());
            break;
          case "Error":
            this.workspaces.set(workspace.get("id")!, Err(event.data));
            queryClient.invalidateQueries(localWorkspaceInfo(workspace.get("id")!));
            queryClient.invalidateQueries(allRunbookIds());
            queryClient.invalidateQueries(allRunbooks());
            break;
          case "RunbookChanged":
            useStore.getState().queryClient.invalidateQueries(runbookById(event.data));
            const runbook = await OfflineRunbook.load(event.data);
            this.emitter.emit("runbook-changed", runbook);
            break;
          case "RunbookDeleted":
            this.emitter.emit("runbook-deleted", event.data);
            break;
          default:
            const exhaustiveCheck: never = event;
            throw new Error(`Unhandled workspace event: ${exhaustiveCheck}`);
        }
      });
    }
  }

  public onRunbookDeleted(callback: (runbookId: string) => void) {
    return this.emitter.on("runbook-deleted", callback);
  }

  public onRunbookChanged(callback: (runbook: OfflineRunbook) => void) {
    return this.emitter.on("runbook-changed", callback);
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

  public getWorkspaces(): WorkspaceState[] {
    return Array.from(this.workspaces.values())
      .filter((result) => result.isOk())
      .map((result) => result.unwrap());
  }

  public getWorkspaceInfo(workspaceId: string): Option<Result<WorkspaceState, WorkspaceError>> {
    return Some(this.workspaces.get(workspaceId));
  }
}
