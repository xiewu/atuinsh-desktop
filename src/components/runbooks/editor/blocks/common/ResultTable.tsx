import {
  DataEditor,
  GridCell,
  GridCellKind,
  GridColumn,
  Item,
} from "@glideapps/glide-data-grid";

import "@glideapps/glide-data-grid/dist/index.css";
import { useMemo } from "react";

export const getCellContent =
  (results: any[], columns: GridColumn[]) =>
  ([col, row]: Item): GridCell => {
    if (!results) throw new Error("Trying to render cell without results");

    const item = results[row];
    const key = columns[col].id;

    if (!key) throw new Error("Trying to render cell without key");

    const value = item[col];

    // Determine the type of the value and return appropriate cell data
    if (typeof value === "number") {
      return {
        kind: GridCellKind.Number,
        data: value,
        displayData: value.toString(),
        allowOverlay: true,
        readonly: true,
      };
    } else if (typeof value === "boolean") {
      return {
        kind: GridCellKind.Boolean,
        data: value,
        allowOverlay: false,
        readonly: true,
      };
    } else if (Array.isArray(value)) {
      return {
        kind: GridCellKind.Text,
        data: value.join(", "),
        displayData: value.join(", "),
        allowOverlay: true,
        readonly: true,
      };
    } else if (typeof value === "object" && value !== null) {
      return {
        kind: GridCellKind.Text,
        data: JSON.stringify(value),
        displayData: JSON.stringify(value),
        allowOverlay: true,
        readonly: true,
      };
    } else {
      return {
        kind: GridCellKind.Text,
        data: String(value),
        displayData: String(value),
        allowOverlay: true,
        readonly: true,
      };
    }
  };

export default function ResultTable({
  columns,
  results,
  setColumns,
  width,
}: any) {
  const cellContent = useMemo(
    () => getCellContent(results, columns),
    [results, columns],
  );

  // PERF: Note that getCellsForSelection can be a bit slow with a LOT of rows
  // Optimise in the future. Would be cool as fuck to render millions of rows.

  return (
    <DataEditor
      className="w-full p-0 m-0"
      getCellContent={cellContent}
      getCellsForSelection={true}
      columns={columns}
      rows={results.length}
      width={width}
      onColumnResize={(_col, newSize, index) => {
        setColumns((prev: GridColumn[]) => {
          const newColumns = [...prev];
          newColumns[index] = {
            ...newColumns[index],
            width: newSize,
          };
          return newColumns;
        });
      }}
    />
  );
}
