import Workspace from "@/state/runbooks/workspace";
import WorkspaceStrategy, { DoFolderOp } from "./strategy";
import Operation, {
  createFolder,
  createRunbook,
  createWorkspace,
  moveItems,
  renameWorkspace,
  updateFolderName,
} from "@/state/runbooks/operation";
import { Err, None, Ok, Result, Some } from "@binarymuse/ts-stdlib";
import Runbook from "@/state/runbooks/runbook";
import { DialogBuilder } from "@/components/Dialogs/dialog";
import * as api from "@/api/api";
import { useStore } from "@/state/store";
import track_event from "@/tracking";
import doWorkspaceFolderOp from "@/state/runbooks/workspace_folder_ops";
import { WorkspaceError } from "@/rs-bindings/WorkspaceError";
import { uuidv7 } from "uuidv7";

export default class OnlineStrategy implements WorkspaceStrategy {
  constructor(private workspace: Workspace) {}

  async createWorkspace(unsavedWorkspace: Workspace): Promise<Result<Workspace, WorkspaceError>> {
    try {
      await unsavedWorkspace.save();

      const op = new Operation({
        operation: createWorkspace(
          unsavedWorkspace.get("id")!,
          unsavedWorkspace.get("name")!,
          unsavedWorkspace.isOrgOwned()
            ? { type: "org", orgId: unsavedWorkspace.get("orgId")! }
            : { type: "user" },
        ),
      });
      await op.save();
    } catch (err) {
      if (err instanceof Error) {
        return Err({
          type: "WorkspaceCreateError",
          data: {
            workspace_id: unsavedWorkspace.get("id")!,
            message: err.message,
          },
        } as WorkspaceError);
      } else {
        return Err({
          type: "WorkspaceCreateError",
          data: {
            workspace_id: unsavedWorkspace.get("id")!,
            message: "An unknown error occurred while creating the workspace.",
          },
        } as WorkspaceError);
      }
    }

    return Ok(unsavedWorkspace);
  }

  async renameWorkspace(
    workspace: Workspace,
    newName: string,
  ): Promise<Result<undefined, WorkspaceError>> {
    try {
      workspace.set("name", newName);
      await workspace.save();

      const op = new Operation({
        operation: renameWorkspace(workspace.get("id")!, newName),
      });
      await op.save();
      return Ok(undefined);
    } catch (err) {
      if (err instanceof Error) {
        return Err({
          type: "WorkspaceRenameError",
          data: {
            workspace_id: workspace.get("id")!,
            message: err.message,
          },
        } as WorkspaceError);
      } else {
        return Err({
          type: "WorkspaceRenameError",
          data: {
            workspace_id: workspace.get("id")!,
            message: "An unknown error occurred while renaming the workspace.",
          },
        } as WorkspaceError);
      }
    }
  }

  async deleteWorkspace(id: string): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async createRunbook(
    workspaceId: string,
    parentFolderId: string | null,
  ): Promise<Result<Runbook, WorkspaceError>> {
    const workspace = await Workspace.get(workspaceId);
    if (!workspace) {
      return Err({
        type: "WorkspaceReadError",
        data: {
          path: workspaceId,
          message: "Workspace not found",
        },
      } as WorkspaceError);
    }

    const rb = await Runbook.createUntitled(workspace, true);
    await this.onRunbookCreated(rb, parentFolderId);
    return Ok(rb);
  }

  async createFolder(
    doFolderOp: DoFolderOp,
    parentId: string | null,
    name: string,
  ): Promise<Result<string, WorkspaceError>> {
    const id = uuidv7();
    const success = await doFolderOp(
      (wsf) => wsf.createFolder(id, "New Folder", parentId),
      (changeRef) => {
        return Some(createFolder(this.workspace.get("id")!, parentId, id, "New Folder", changeRef));
      },
    );

    if (success) {
      return Ok(id);
    } else {
      return Err({
        type: "FolderCreateError",
        data: {
          workspace_id: this.workspace.get("id")!,
          name: name,
          message: "Failed to create folder",
        },
      } as WorkspaceError);
    }
  }

  async renameFolder(
    doFolderOp: DoFolderOp,
    workspaceId: string,
    folderId: string,
    newName: string,
  ): Promise<Result<undefined, WorkspaceError>> {
    let success = await doFolderOp(
      (wsf) => wsf.renameFolder(folderId, newName),
      (changeRef) => {
        return Some(updateFolderName(workspaceId, folderId, newName, changeRef));
      },
    );

    if (!success) {
      return Err({
        type: "FolderRenameError",
        data: {
          workspace_id: workspaceId,
          folder_id: folderId,
          message: "Failed to rename folder",
        },
      } as WorkspaceError);
    }

    return Ok(undefined);
  }

  async moveItems(
    doFolderOp: DoFolderOp,
    ids: string[],
    parentId: string | null,
    index: number,
  ): Promise<Result<undefined, WorkspaceError>> {
    doFolderOp(
      (wsf) => wsf.moveItems(ids, parentId, index),
      (changeRef) => {
        return Some(moveItems(this.workspace.get("id")!, ids, parentId, index, changeRef));
      },
    );

    return Ok(undefined);
  }

  private async onRunbookCreated(runbook: Runbook, parentFolderId: string | null): Promise<void> {
    // NOTE [mkt]:
    // This API call is made here instead of through the operation processor
    // because we need to wait for the runbook to be created on the server
    // before opening it; this is so the server observer doesn't create an
    // observer for the runbook and cause a YJS sync conflict.
    //
    // Note that this requires `currentRunbookId` to be set synchronously,
    // so that we create a PhoenixProvider via RunbookEditor,
    // which is why we call `handleRunbookActivate` before updating
    // the workspace folder (which would trigger the server observer).
    const workspace = await Workspace.get(runbook.workspaceId);
    if (!workspace) {
      return;
    }

    if (!runbook) {
      new DialogBuilder()
        .title("Could not load runbook")
        .message("We were unable to load the runbook.")
        .action({ label: "OK", value: "ok", variant: "flat" })
        .build();
      return;
    }

    let startedSyncIndicator = false;
    try {
      // TODO: use sync increment/decrement???
      if (!useStore.getState().isSyncing) {
        startedSyncIndicator = true;
        useStore.getState().setIsSyncing(true);
      }

      await api.createRunbook(runbook, runbook.id, "private");
    } catch (err) {
      if (err instanceof api.HttpResponseError) {
        new DialogBuilder()
          .title("Failed to create online runbook")
          .message("The API request to create the runbook failed.")
          .action({ label: "OK", value: "ok", variant: "flat" })
          .build();
      } else {
        new DialogBuilder()
          .title("Failed to create runbook")
          .message("You may be offline, or the server may be down.")
          .action({ label: "OK", value: "ok", variant: "flat" })
          .build();
      }
      console.error(err);
      runbook.delete();
      return;
    } finally {
      if (startedSyncIndicator) {
        useStore.getState().setIsSyncing(false);
      }
    }

    track_event("runbooks.create");
    // TODO[mkt]: Activate the runbook here (callback?)

    doWorkspaceFolderOp(
      workspace.get("id")!,
      (wsf) => {
        wsf.createRunbook(runbook.id, parentFolderId);
        return true;
      },
      (changeRef) => {
        if (workspace && workspace.isOnline()) {
          return Some(createRunbook(workspace.get("id")!, parentFolderId, runbook.id, changeRef));
        } else {
          return None;
        }
      },
    );
  }
}
