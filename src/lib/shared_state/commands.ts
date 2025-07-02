import { invoke } from "@tauri-apps/api/core";
import { SharableState, OptimisticUpdate, SharedStateDocument, Version, ChangeRef } from "./types";

export async function getSharedStateDocument<T extends SharableState>(
  stateId: string,
): Promise<SharedStateDocument<T> | undefined> {
  const document = await invoke<SharedStateDocument<T>>("get_shared_state_document", {
    name: stateId,
  });
  return document;
}

export async function pushOptimisticUpdate(stateId: string, update: OptimisticUpdate) {
  await invoke("push_optimistic_update", { name: stateId, update });
}

export async function updateSharedStateDocument<T extends SharableState>(
  stateId: string,
  value: T,
  version: Version,
) {
  await invoke("update_shared_state_document", { name: stateId, value, version });
}

export async function deleteSharedStateDocument(stateId: string) {
  await invoke("delete_shared_state_document", { name: stateId });
}

export async function removeOptimisticUpdates(stateId: string, changeRefs: ChangeRef[]) {
  await invoke("remove_optimistic_updates", { name: stateId, changeRefs });
}
