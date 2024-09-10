/*
export const postgresSchema = async (
  database: Database,
): Promise<TableSchema[]> => {
  const query = `
    SELECT
      t.table_name,
      array_agg(json_build_object('name', c.column_name, 'type', c.data_type) ORDER BY c.ordinal_position) as columns
    FROM
      information_schema.tables t
    JOIN
      information_schema.columns c ON t.table_name = c.table_name
    WHERE
      t.table_schema = 'public'
    GROUP BY
      t.table_name
    ORDER BY
      t.table_name;
  `;

  const result: any[] = await database.select(query);

  return result.map((row) => ({
    name: row.table_name,
    columns: row.columns,
  }));
};
*/
