import { uuidv7 } from "uuidv7";
import AtuinDB from "../atuin_db";

export type OperationData = {
  type: "runbook_deleted";
  runbookId: string;
};

export interface OperationAttrs {
  id?: string;
  operation: OperationData;
  processedAt?: Date;
  created?: Date;
  updated?: Date;
}

export default class Operation {
  private persisted = false;

  public id: string;
  public operation: OperationData;
  public processedAt?: Date;
  public created?: Date;
  public updated?: Date;

  constructor(attrs: OperationAttrs) {
    this.id = attrs.id || uuidv7();
    this.operation = attrs.operation;
    this.processedAt = attrs.processedAt ? new Date(attrs.processedAt) : undefined;
  }

  public static async load(id: string): Promise<Operation | null> {
    const db = await AtuinDB.load("runbooks");

    const query = "SELECT * FROM operation_log WHERE id = $1";
    const res = await db.select<Operation[]>(query, [id]);
    if (res.length === 0) return null;

    return Operation.fromRow(res[0]);
  }

  public static async getUnprocessed(): Promise<Operation[]> {
    const db = await AtuinDB.load("runbooks");

    const query = "SELECT * FROM operation_log WHERE processed_at IS NULL ORDER BY created ASC";
    const res = await db.select<Operation[]>(query);

    return res.map((row) => Operation.fromRow(row));
  }

  private static fromRow(row: any) {
    const model = new Operation({
      id: row.id,
      operation: JSON.parse(row.operation),
      processedAt: row.processed_at ? new Date(row.processed_at / 1000000) : undefined,
      created: new Date(row.created / 1000000),
      updated: new Date(row.updated / 1000000),
    });
    model.persisted = true;
    return model;
  }

  public async save() {
    if (!this.persisted) {
      return this._saveInsert();
    } else {
      return this._saveUpdate();
    }
  }

  private async _saveInsert() {
    const db = await AtuinDB.load("runbooks");

    const query = `INSERT INTO operation_log(id, operation, processed_at, created, updated)
                    VALUES ($1, $2, $3, $4, $5)`;
    await db.execute(query, [
      this.id,
      JSON.stringify(this.operation),
      this.processedAt ? this.processedAt.getTime() * 1000000 : null,
      new Date().getTime() * 1000000,
      new Date().getTime() * 1000000,
    ]);
  }

  private async _saveUpdate() {
    const db = await AtuinDB.load("runbooks");

    const query = `UPDATE operation_log SET operation = $2, processed_at = $3, updated = $4
                    WHERE id = $1`;

    await db.execute(query, [
      this.id,
      JSON.stringify(this.operation),
      this.processedAt ? this.processedAt.getTime() * 1000000 : null,
      new Date().getTime() * 1000000,
    ]);
  }
}
