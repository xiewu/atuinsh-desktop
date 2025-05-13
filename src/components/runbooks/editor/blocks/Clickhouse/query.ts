import { QueryResult } from "../common/database";
import { createClient, ClickHouseClient } from "@clickhouse/client-web";

const runSelect = async (
  client: ClickHouseClient,
  query: string,
): Promise<QueryResult> => {
  let res = await client.query({
    query: query,
  });

  let data = await res.json();

  // @ts-ignore
  const columns = data?.meta?.map((col) => col.name);
  // @ts-ignore
  const rows = data?.data.map((obj) => columns.map((key) => obj[key]));

  return {
    time: new Date(),
    rows: rows,
    // @ts-ignore
    rowsRead: data.statistics.rows_read,
    // @ts-ignore
    bytesRead: data.statistics.bytes_read,
    // @ts-ignore
    columns: data.meta,
    rowsAffected: 0,
    lastInsertID: null,
    // @ts-ignore
    duration: data.statistics.elapsed,
  };
};

// Right now we're using the web clickhouse client
// In the future, I want to use the native Rust client
// Unfortunately, the official client doesn't support the native protocol, and seems
// a bit naive. We'd also need to write a lot of glue code to make the deserialization
// work OK with the frontend. Looks like there's some raw block streaming stuff maybe?
export const runQuery = async (
  uri: string,
  query: string,
): Promise<QueryResult> => {
  let client = createClient({
    url: uri,
  });

  const statements = query.split(";");

  if (statements.length >= 1) {
    query = statements[0];
  } else if (statements.length === 0) {
    throw new Error("No query to run");
  }

  // Determine if we run a select or an execute, based on if the first word is select or not

  const firstWord = (query.split(" ").filter((word) => word.trim() !== "")[0] || "").toLowerCase();

  if (firstWord === "select") {
    return await runSelect(client, query);
  }

  let start = performance.now();
  await client.exec({ query });

  return {
    time: new Date(),
    rows: null,
    columns: null,
    rowsAffected: 0,
    lastInsertID: null,
    duration: performance.now() - start,
  };
};
