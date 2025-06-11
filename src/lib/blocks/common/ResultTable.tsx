import {
  DataEditor,
  GridCell,
  GridCellKind,
  GridColumn,
  Item,
  Theme,
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

const darkTheme: Partial<Theme> = {
  accentColor: "#4F5DFF",
  accentFg: "#FFFFFF",
  accentLight: "rgba(79, 93, 255, 0.2)",

  textDark: "#FFFFFF",
  textMedium: "#B8B8B8",
  textLight: "#888888",
  textBubble: "#FFFFFF",

  bgIconHeader: "#B8B8B8",
  fgIconHeader: "#1A1A1A",
  textHeader: "#FFFFFF",
  textGroupHeader: "#CCCCCCBB",
  textHeaderSelected: "#FFFFFF",

  bgCell: "#2A2A2A",
  bgCellMedium: "#333333",
  bgHeader: "#1E1E1E",
  bgHeaderHasFocus: "#404040",
  bgHeaderHovered: "#383838",

  bgBubble: "#404040",
  bgBubbleSelected: "#2A2A2A",

  bgSearchResult: "#4A4A00",

  borderColor: "rgba(255, 255, 255, 0.12)",
  drilldownBorder: "rgba(255, 255, 255, 0.12)",

  linkColor: "#7B8CFF",
};

interface ResultTableProps {
  columns: GridColumn[];
  results: any[];
  setColumns?: (columns: GridColumn[]) => void;
  width: string;
  colorMode?: "dark" | "light";
}

export default function ResultTable({
  columns,
  results,
  setColumns,
  width,
  colorMode,
}: ResultTableProps) {
  const cellContent = useMemo(() => getCellContent(results, columns), [results, columns]);

  const theme: Partial<Theme> = colorMode === "dark" ? darkTheme : {};

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
      theme={theme}
      onColumnResize={(_col, newSize, index) => {
        const newColumns = [...columns];
        newColumns[index] = {
          ...newColumns[index],
          width: newSize,
        };
        setColumns?.(newColumns);
      }}
    />
  );
}
