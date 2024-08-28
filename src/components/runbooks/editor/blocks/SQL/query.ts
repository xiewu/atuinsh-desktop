import Database from "@tauri-apps/plugin-sql";
import { sqliteSchema, TableSchema } from "./schema";

interface QueryResult {
  schema: TableSchema[];
  results: any[] | null;
  rowsAffected: number | null;
  lastInsertID: number | null;
}

export const runQuery = async (uri, query): Promise<QueryResult> => {
  // Firsts up, let's process the query a little. This is probably too naive, but we shall see.
  // 1. Only run the _first_ statement in the input
  // 2. If the statement is a SELECT, run it and display the results
  // 3. If the statement is an INSERT/UPDATE/whatever, run it and display the number of rows affected

  const statements = query.split(";");

  if (statements.length >= 1) {
    query = statements[0];
  } else if (statements.length === 0) {
    throw new Error("No query to run");
  }

  // Determine if we run a select or an execute, based on if the first word is select or not

  let db = await Database.load(uri);
  let schema = await sqliteSchema(db);

  const firstWord = query.split(" ")[0].toLowerCase();

  if (firstWord === "select") {
    let res = await db.select(query);

    return {
      schema,
      results: res,
      rowsAffected: null,
      lastInsertID: null,
    };
  }

  let res = await db.execute(query);

  return {
    schema,
    lastInsertID: res.lastInsertId,
    rowsAffected: res.rowsAffected,
    results: null,
  };
};
