import { GlobalSpec, Model, Persistence } from "ts-tiny-activerecord";
import createTauriAdapter, { setTimestamps } from "@/lib/db/tauri-ar-adapter";
import { DateEncoder, JSONEncoder } from "@/lib/db/encoders";
import { SharedStateManager } from "@/lib/shared_state/manager";
import { AtuinSharedStateAdapter } from "@/lib/shared_state/adapter";
import { dbHook } from "@/lib/db_hooks";

export type WorkspaceAttrs = {
  id?: string;
  name: string;
  orgId?: string | null;
  permissions?: string[];

  created?: Date;
  updated?: Date;
};

const adapter = createTauriAdapter<WorkspaceAttrs>({
  dbName: "runbooks",
  tableName: "workspaces",
});

const fieldSpecs = {
  permissions: { encoder: JSONEncoder },
  created: { encoder: DateEncoder },
  updated: { encoder: DateEncoder },
};

const globalSpecs: GlobalSpec<WorkspaceAttrs> = {
  preSave: setTimestamps,
  postSave: async (_context, model, type) => {
    dbHook("workspace", type === "insert" ? "create" : "update", model);
    if (type === "insert") {
      SharedStateManager.startInstance(
        `workspace-folder:${model.get("id")}`,
        new AtuinSharedStateAdapter(`workspace-folder:${model.get("id")}`),
      );
    }
  },
  postDelete: async (_context, model) => {
    dbHook("workspace", "delete", model);
    SharedStateManager.stopInstance(`workspace-folder:${model.get("id")}`);
  },
};

@Persistence<WorkspaceAttrs>(adapter, fieldSpecs, globalSpecs)
export default class Workspace extends Model<WorkspaceAttrs> {
  canManageRunbooks(): boolean {
    const permissions = this.get("permissions");
    return !permissions || permissions.includes("manage_runbooks");
  }
}
