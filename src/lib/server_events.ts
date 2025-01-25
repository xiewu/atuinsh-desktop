import { AtuinStore } from "@/state/store";
import SyncManager from "./sync/sync_manager";
import { QueryClient } from "@tanstack/react-query";
import ServerNotificationManager from "@/server_notification_manager";
import * as api from "@/api/api";
import Runbook from "@/state/runbooks/runbook";

export function setupServerEvents(
  store: AtuinStore,
  notificationManager: ServerNotificationManager,
  syncManager: SyncManager,
  queryClient: QueryClient,
) {
  notificationManager.on("runbook_updated", (runbookId: string) => {
    syncManager.runbookUpdated(runbookId);
    queryClient.invalidateQueries({ queryKey: ["remote_runbook", runbookId] });
  });

  notificationManager.on("runbook_deleted", (runbookId: string) => {
    syncManager.runbookUpdated(runbookId);
    queryClient.invalidateQueries({ queryKey: ["remote_runbook", runbookId] });
  });

  notificationManager.on("collab_invited", async (collabId: string) => {
    try {
      const collab = await api.getCollaborationById(collabId);
      store.getState().addCollaboration(collab);
    } catch (err) {}
  });

  notificationManager.on("collab_accepted", async (collabId: string) => {
    store.getState().markCollaborationAccepted(collabId);
    try {
      const collab = await api.getCollaborationById(collabId);
      queryClient.invalidateQueries({ queryKey: ["remote_runbook", collab.runbook.id] });
    } catch (err) {}
  });

  notificationManager.on("collab_deleted", async (collabId: string) => {
    const { collaborations, removeCollaboration } = store.getState();
    const collaboration = collaborations.find((c) => c.id === collabId);
    if (collaboration) {
      const existingIds = await Runbook.allIdsInAllWorkspaces();
      // Only schedule the runbook for a sync update if it already exists locally
      if (collaboration.runbook.id in existingIds) {
        syncManager.runbookUpdated(collaboration.runbook.id);
      }
      queryClient.invalidateQueries({ queryKey: ["remote_runbook", collaboration.runbook.id] });
    }
    removeCollaboration(collabId);
  });
}
