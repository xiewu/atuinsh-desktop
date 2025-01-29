import { Model, Persistence } from "ts-tiny-activerecord";
import createTauriAdapter, { setTimestamps } from "@/lib/db/tauri-ar-adapter";
import { DateEncoder, JSONEncoder } from "@/lib/db/encoders";

export type OperationData =
  | {
      type: "runbook_deleted";
      runbookId: string;
    }
  | {
      type: "snapshot_deleted";
      snapshotId: string;
    };

export type OperationAttrs = {
  id?: string;
  operation: OperationData;
  processedAt?: Date | null;
  created?: Date;
  updated?: Date;
};

const adapter = createTauriAdapter<OperationAttrs>({
  dbName: "runbooks",
  tableName: "operation_log",
});

const fieldSpecs = {
  operation: { encoder: JSONEncoder },
  processedAt: { encoder: DateEncoder },
  created: { encoder: DateEncoder },
  updated: { encoder: DateEncoder },
}

const globalSpecs = {
  preSave: setTimestamps,
}

@Persistence<OperationAttrs>(adapter, fieldSpecs, globalSpecs)
export default class Operation extends Model<OperationAttrs> {
  static async getUnprocessed(): Promise<Operation[]> {
    return Operation.all({ processedAt: null });
  }
}
