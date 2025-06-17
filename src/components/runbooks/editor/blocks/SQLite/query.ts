import Database from "@tauri-apps/plugin-sql";
import { QueryResult } from "@/lib/blocks/common/database";

export const runQuery = async (
  uri: string,
  query: string,
): Promise<QueryResult> => {
  if (!uri.startsWith("sqlite://")) {
    uri = `sqlite://${uri}`;
  }

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

  const firstWord = query.trim().split(/\s+/)[0].toLowerCase();

  if (firstWord === "select") {
    let start = performance.now();
    let res = await db.select<any[]>(query);

    if (res.length === 0) {
      return {
        time: new Date(),
        columns: null,
        rows: null,
        rowsAffected: null,
        lastInsertID: null,
        duration: performance.now() - start,
      };
    }

    return {
      time: new Date(),
      columns: Object.keys(res[0]).map((col) => ({ name: col, type: "" })),
      rows: res.map((i) => Object.values(i)),
      rowsAffected: null,
      lastInsertID: null,
      duration: performance.now() - start,
    };
  }

  let start = performance.now();
  let res = await db.execute(query);

  return {
    time: new Date(),
    columns: null,
    rows: null,
    lastInsertID: res.lastInsertId,
    rowsAffected: res.rowsAffected,
    duration: performance.now() - start,
  };
};
