import { TableSchema } from "@/lib/blocks/common/database";
import Database from "@tauri-apps/plugin-sql";

export const sqliteSchema = async (
  database: Database,
): Promise<TableSchema[]> => {
  const query = `
    SELECT
      m.name AS table_name,
      json_group_array(
        json_object(
          'name', p.name,
          'type', p.type
        )
      ) AS columns
    FROM
      sqlite_master m
    LEFT JOIN
      pragma_table_info(m.name) p
    WHERE
      m.type = 'table'
    GROUP BY
      m.name
    ORDER BY
      m.name;
  `;

  const results: any[] = await database.select(query);

  return results.map((row) => ({
    name: row.table_name,
    columns: JSON.parse(row.columns),
  }));
};
