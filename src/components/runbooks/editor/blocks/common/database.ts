export interface ColumnSchema {
  name: string;
  type: string;
}

export interface TableSchema {
  name: string;
  columns: ColumnSchema[];
}

export interface QueryResult {
  columns: string[] | null;
  rows: any[] | null;
  rowsAffected: number | null;
  lastInsertID: number | null;
}
