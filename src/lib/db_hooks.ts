import Workspace from "@/state/runbooks/workspace";
import { allRunbookIds, allRunbooks, runbookById, runbooksByWorkspaceId } from "./queries/runbooks";
import Runbook from "@/state/runbooks/runbook";
import { useStore } from "@/state/store";
import { InvalidateQueryFilters } from "@tanstack/react-query";
import { allWorkspaces, workspaceById } from "./queries/workspaces";
import Snapshot from "@/state/runbooks/snapshot";
import { snapshotByRunbookAndTag, snapshotsByRunbook } from "./queries/snapshots";
import Operation from "@/state/runbooks/operation";
import SyncManager from "./sync/sync_manager";

export type Model = "runbook" | "workspace" | "snapshot";
export type Action = "create" | "update" | "delete";

export function dbHook(kind: Model, action: Action, model: any) {
  invalidateQueryKeys(kind, action, model);

  if (kind === "runbook" && action === "delete") {
    const op = new Operation({ operation: { type: "runbook_deleted", runbookId: model.id } });
    op.save().then(() => {
      SyncManager.get(useStore).runbookUpdated(model.id);
    });
  }
}

export function invalidateQueryKeys(kind: Model, action: Action, model: any) {
  const queryKeys = getQueryKeys(kind, action, model);

  queryKeys.forEach((queryKey) => {
    if (!Array.isArray(queryKey)) {
      queryKey = queryKey.queryKey;
    }

    useStore.getState().queryClient.invalidateQueries(queryKey);
  });
}

function getQueryKeys(
  kind: Model,
  action: Action,
  model: any,
): InvalidateQueryFilters<any, any, any, any>[] {
  switch (kind) {
    case "runbook":
      return getRunbookQueryKeys(action, model as Runbook);
    case "workspace":
      return getWorkspaceQueryKeys(action, model as Workspace);
    case "snapshot":
      return getSnapshotQueryKeys(action, model as Snapshot);
  }
}

function getRunbookQueryKeys(
  action: Action,
  model: Runbook,
): InvalidateQueryFilters<any, any, any, any>[] {
  switch (action) {
    case "create":
      return [
        allRunbookIds(),
        allRunbooks(),
        runbooksByWorkspaceId(model.workspaceId),
        allWorkspaces(),
      ];
    case "update":
      return [runbookById(model.id), runbooksByWorkspaceId(model.workspaceId)];
    case "delete":
      return [
        allRunbookIds(),
        allRunbooks(),
        runbooksByWorkspaceId(model.workspaceId),
        allWorkspaces(),
      ];
  }
}

function getWorkspaceQueryKeys(
  action: Action,
  model: Workspace,
): InvalidateQueryFilters<any, any, any, any>[] {
  switch (action) {
    case "create":
      return [allWorkspaces()];
    case "update":
      return [allWorkspaces(), workspaceById(model.id)];
    case "delete":
      return [allWorkspaces()];
  }
}

function getSnapshotQueryKeys(
  action: Action,
  model: Snapshot,
): InvalidateQueryFilters<any, any, any, any>[] {
  switch (action) {
    case "create":
      return [snapshotsByRunbook(model.runbook_id)];
    case "update":
      return [
        snapshotsByRunbook(model.runbook_id),
        snapshotByRunbookAndTag(model.runbook_id, model.tag),
      ];
    case "delete":
      return [
        snapshotsByRunbook(model.runbook_id),
        snapshotByRunbookAndTag(model.runbook_id, model.tag),
      ];
  }
}
