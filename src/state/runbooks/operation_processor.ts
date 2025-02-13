import { usernameFromNwo } from "@/lib/utils";
import { RemoteRunbook } from "../models";
import Operation, { OperationData } from "./operation";
import * as api from "@/api/api";
import { useStore } from "../store";
import Logger from "@/lib/logger";
const logger = new Logger("OperationProcessor");

function assertUnreachable(_x: never): never {
  throw new Error("Unreachable clause");
}

export async function processUnprocessedOperations(): Promise<void> {
  const ops = await Operation.getUnprocessed();

  if (ops.length > 0) {
    logger.info(`Processing ${ops.length} operations from the operations log`);
  } else {
    return;
  }

  for (const op of ops) {
    let success = false;
    try {
      success = await processOperation(op);
    } catch (err) {
      continue;
    }

    if (success) {
      op.set("processedAt", new Date());
      await op.save();
    }
  }

  logger.info(`Finished processing operations`);
}

export function processOperation(op: Operation): Promise<boolean> {
  const details = op.get("operation") as OperationData;

  switch (details.type) {
    case "runbook_deleted": {
      return processRunbookDeleted(details.runbookId);
    }
    case "snapshot_deleted": {
      return processSnapshotDeleted(details.snapshotId);
    }
  }
  // Ensure all possible operation types are checked
  return assertUnreachable(details);
}

async function processRunbookDeleted(runbookId: string): Promise<boolean> {
  let remoteRunbook: RemoteRunbook | null = null;
  try {
    remoteRunbook = await api.getRunbookID(runbookId);
  } catch (err) {
    if (err instanceof api.HttpResponseError && err.code === 404) {
      // No runbook exists on the remote. In this case, there's nothing to process
      return true;
    } else {
      // Looks like we're offline
      return false;
    }
  }

  const isOwner = usernameFromNwo(remoteRunbook.nwo) === useStore.getState().user.username;
  const isCollaborator = !isOwner && remoteRunbook.permissions.includes("update_content");

  if (isOwner) {
    await api.deleteRunbook(runbookId);
    return true;
  } else if (isCollaborator) {
    const collab = await api.getCollaborationForRunbook(runbookId);
    if (!collab) return true;

    await api.deleteCollaboration(collab.id);
    return true;
  } else {
    return true;
  }
}

async function processSnapshotDeleted(snapshotId: string): Promise<boolean> {
  await api.deleteSnapshot(snapshotId);
  return true;
}
