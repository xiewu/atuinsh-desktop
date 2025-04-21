import { ChangeRef } from "@/lib/shared_state/types";
import WorkspaceFolder, { Folder, FolderItem } from "./workspace_folders";
import Operation, { OperationData } from "./operation";
import { AtuinSharedStateAdapter } from "@/lib/shared_state/adapter";
import { SharedStateManager } from "@/lib/shared_state/manager";
import { TreeData } from "@/lib/tree";
import { Rc } from "@binarymuse/ts-stdlib";

type FolderOpResult = {
  success: boolean;
  changeRef?: ChangeRef;
};

export const doFolderOp = async (
  updateFolderState: (
    callback: (
      data: TreeData<FolderItem>,
      cancel: () => undefined,
    ) => TreeData<FolderItem> | undefined,
  ) => Promise<ChangeRef | undefined>,
  op: (wsf: WorkspaceFolder, cancel: () => undefined) => boolean,
  operation: (changeRef: ChangeRef) => OperationData,
): Promise<FolderOpResult> => {
  const changeRef = await updateFolderState((state, cancel) => {
    const workspaceFolder = WorkspaceFolder.fromJS(state);
    const success = op(workspaceFolder, cancel);
    if (success === true) {
      return workspaceFolder.toJS();
    } else {
      return cancel();
    }
  });

  if (changeRef) {
    const opData = operation(changeRef);
    const op = new Operation({ operation: opData });
    try {
      await op.save();
      return { success: true, changeRef };
    } catch (_e) {
      return { success: false, changeRef };
    }
  } else {
    return { success: false };
  }
};

export default async function doWorkspaceFolderOp(
  workspaceId: string,
  op: (wsf: WorkspaceFolder, cancel: () => undefined) => boolean,
  operation: (changeRef: ChangeRef) => OperationData,
): Promise<boolean> {
  const stateId = `workspace-folder:${workspaceId}`;
  const manager = SharedStateManager.getInstance<Folder>(
    stateId,
    new AtuinSharedStateAdapter(stateId),
  );

  try {
    const result = await doFolderOp(manager.updateOptimistic, op, operation);
    if (!result.success && result.changeRef) {
      await manager.expireOptimisticUpdates([result.changeRef]);
    }
    return result.success;
  } finally {
    Rc.dispose(manager);
  }
}
