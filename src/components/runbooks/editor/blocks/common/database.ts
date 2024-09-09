export interface ColumnSchema {
  name: string;
  type: string;
}

export interface TableSchema {
  name: string;
  columns: ColumnSchema[];
}

export interface QueryResult {
  columns: ColumnSchema[] | null;
  rows: any[] | null;
  rowsAffected: number | null;
  lastInsertID: number | null;
  duration: number;
  time: Date;
}
