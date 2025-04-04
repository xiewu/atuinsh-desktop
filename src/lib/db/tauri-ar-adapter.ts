import { AdapterConfig, Model, ModelAttributes } from "ts-tiny-activerecord";
import Database from "@tauri-apps/plugin-sql";
import AtuinDB, { AtuinDatabase } from "@/state/atuin_db";
import { uuidv7 } from "uuidv7";

function camelCaseToSnakeCase(str: string) {
  return str.replace(/([A-Z])/g, "_$1").toLowerCase();
}

function snakeCaseToCamelCase(str: string) {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function convertRowToCamelCase<T>(row: any): T {
  if (!row) return row;
  const converted: any = {};
  for (const [key, value] of Object.entries(row)) {
    converted[snakeCaseToCamelCase(key)] = value;
  }
  return converted;
}

function generateId() {
  return uuidv7();
}

export type TauriAdapterConfig = {
  dbName: AtuinDatabase;
  tableName: string;
};

type Context = {
  db: Database;
};

const databases = new Map<AtuinDatabase, Promise<Database>>();

export default function createTauriAdapter<T extends ModelAttributes>(
  config: TauriAdapterConfig,
): AdapterConfig<T> {
  const { dbName, tableName } = config;

  function getPrimaryKeyField() {
    return "id";
  }

  async function getContext() {
    if (!databases.has(dbName)) {
      const db = AtuinDB.load(dbName);
      databases.set(dbName, db);
    }

    return {
      db: await databases.get(dbName)!,
    };
  }

  async function all(context: Context, matchOrQuery?: Partial<T> | string, bindValues?: any[]) {
    let whereClause: string;
    if (matchOrQuery === undefined) {
      whereClause = "";
    } else if (typeof matchOrQuery === "string") {
      whereClause = `WHERE ${matchOrQuery}`;
    } else {
      let skippedFields = new Set<string>();
      whereClause =
        "WHERE " +
        Object.keys(matchOrQuery)
          .map((key) => {
            const value = matchOrQuery[key as keyof T];
            if (value === null) {
              skippedFields.add(key);
              return `${camelCaseToSnakeCase(key)} IS NULL`;
            } else {
              return `${camelCaseToSnakeCase(key)} = ?`;
            }
          })
          .join(" AND ");
      bindValues = Object.keys(matchOrQuery)
        .filter((key) => !skippedFields.has(key))
        .map((key) => matchOrQuery[key as keyof T]);
    }
    let res = await context.db.select<T[]>(`SELECT * FROM ${tableName} ${whereClause}`, bindValues);
    return res.map((row) => convertRowToCamelCase<T>(row));
  }

  async function get(context: Context, primaryKey: any) {
    const res = await context.db.select<T>(
      `SELECT * FROM ${tableName} WHERE ${getPrimaryKeyField()} = $1`,
      [primaryKey],
    );
    if (!res) {
      return null;
    } else if (Array.isArray(res)) {
      if (res.length === 0) {
        return null;
      } else if (res.length === 1) {
        return convertRowToCamelCase<T>(res[0]);
      } else {
        throw new Error("get returned multiple results");
      }
    } else {
      return convertRowToCamelCase<T>(res);
    }
  }

  async function getBy(context: Context, matchOrQuery: Partial<T> | string, bindValues?: any[]) {
    const res = await all(context, matchOrQuery, bindValues);
    if (res.length > 1) throw new Error("getBy returned multiple results");
    return res[0] || null;
  }

  async function insert(context: Context, model: Model<T>, data: Partial<T>) {
    const primaryKey = model.get(getPrimaryKeyField()) || generateId();
    const fields = Object.keys(data).filter((field) => field !== getPrimaryKeyField());
    const snakeCaseFields = fields.map(camelCaseToSnakeCase);
    const query = `INSERT INTO ${tableName} (${getPrimaryKeyField()}, ${snakeCaseFields.join(
      ", ",
    )}) VALUES (?, ${fields.map(() => "?").join(", ")})`;
    const bindValues = [primaryKey, ...fields.map((field) => data[field as keyof T])];
    const res = await context.db.execute(query, bindValues);
    model.put(getPrimaryKeyField(), primaryKey as T[keyof T]);
    return { success: true, inserted: true, rows: res.rowsAffected, primaryKey };
  }

  async function update(context: Context, model: Model<T>, data: Partial<T>) {
    const primaryKey = model.get(getPrimaryKeyField());
    const fields = Object.keys(data).filter((field) => field !== getPrimaryKeyField());
    const query = `UPDATE ${tableName} SET ${fields
      .map((field) => `${camelCaseToSnakeCase(String(field))} = ?`)
      .join(", ")} WHERE ${getPrimaryKeyField()} = ?`;
    const bindValues = [...fields.map((field) => data[field as keyof T]), primaryKey];
    const res = await context.db.execute(query, bindValues);
    return { success: true, inserted: false, rows: res.rowsAffected, primaryKey };
  }

  async function del(context: Context, model: Model<T>) {
    const primaryKey = model.get(getPrimaryKeyField());
    const res = await context.db.execute(
      `DELETE FROM ${tableName} WHERE ${getPrimaryKeyField()} = ?`,
      [primaryKey],
    );
    return !!(res.rowsAffected && res.rowsAffected > 0);
  }

  return { getPrimaryKeyField, getContext, all, get, getBy, insert, update, del };
}

type WithTimestamps = {
  created?: Date;
  updated?: Date;
};

export async function setTimestamps<T extends ModelAttributes & WithTimestamps>(
  _context: Context,
  model: Model<T>,
) {
  if (model.persisted) {
    model.set("updated", new Date());
  } else {
    model.set("created", new Date());
    model.set("updated", new Date());
  }
}
