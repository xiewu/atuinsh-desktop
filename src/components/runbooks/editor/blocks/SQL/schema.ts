import Database from "@tauri-apps/plugin-sql";

export interface ColumnSchema {
  name: string;
  type: string;
}

export interface TableSchema {
  name: string;
  columns: ColumnSchema[];
}

// Fetch the schema for the SQLite database
export const sqliteSchema = async (
  database: Database,
): Promise<TableSchema[]> => {
  // Get a list of all tables in the database
  const tables: any[] = await database.select(
    "SELECT name FROM sqlite_master WHERE type='table';",
  );

  // For each table, fetch the column names and types
  const tableSchemas = await Promise.all(
    tables.map(async (table) => {
      const columns: any[] = await database.select(
        `PRAGMA table_info(${table.name});`,
      );

      return {
        name: table.name,
        columns: columns.map((column) => ({
          name: column.name,
          type: column.type,
        })),
      };
    }),
  );

  return tableSchemas;
};
