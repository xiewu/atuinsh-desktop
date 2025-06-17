import { QueryResult } from "@/lib/blocks/common/database";
import { invoke } from "@tauri-apps/api/core";

export const runQuery = async (
  uri: string,
  query: string,
): Promise<QueryResult> => {
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

  const firstWord = query.trim().split(/\s+/)[0].toLowerCase();

  if (firstWord === "select") {
    let start = performance.now();

    let res = await invoke<any>("postgres_query", {
      uri,
      query,
    });

    return {
      time: new Date(),
      rows: res.rows,
      columns: res.columns,
      rowsAffected: null,
      lastInsertID: null,
      duration: performance.now() - start,
    };
  }

  let start = performance.now();
  let res = await invoke<any>("postgres_execute", { uri, query });

  return {
    time: new Date(),
    rows: null,
    columns: null,
    rowsAffected: res.rowsAffected,
    lastInsertID: null,
    duration: performance.now() - start,
  };
};
