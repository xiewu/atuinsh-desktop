import { useRef, useState } from "react";
import { Input, Card, CardBody } from "@nextui-org/react";
import { DatabaseIcon, Play, Square } from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";
import {
  DataEditor,
  GridCell,
  GridCellKind,
  GridColumn,
  Item,
} from "@glideapps/glide-data-grid";

import "@glideapps/glide-data-grid/dist/index.css";

// @ts-ignore
import { createReactBlockSpec } from "@blocknote/react";
import { insertOrUpdateBlock } from "@blocknote/core";
import { CardHeader } from "@/components/ui/card";

import { runQuery } from "./query";

interface SQLProps {
  driver: string;
  uri: string;
  query: string;
}

const SQL = ({ query }: SQLProps) => {
  const [q, setQ] = useState<string>("");
  const [isRunning, setIsRunning] = useState<boolean>(false);

  const [lastInsertID, setLastInsertID] = useState<number | null>(null);
  const [rowsAffected, setRowsAffected] = useState<number | null>(null);

  //const [schema, setSchema] = useState<any | null>(null);
  const [results, setResults] = useState<any[] | null>(null);
  const [columns, setColumns] = useState<GridColumn[]>([]);

  const [error, setError] = useState<string | null>(null);

  const bodyRef = useRef<HTMLDivElement>(null);

  const getCellContent = ([col, row]: Item): GridCell => {
    if (!results) throw new Error("Trying to render cell without results");

    const item = results[row];
    const key = columns[col].id;

    if (!key) throw new Error("Trying to render cell without key");

    const value = item[key];

    // Determine the type of the value and return appropriate cell data
    if (typeof value === "number") {
      return {
        kind: GridCellKind.Number,
        data: value,
        displayData: value.toString(),
        allowOverlay: false,
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
        allowOverlay: false,
        readonly: true,
      };
    } else if (typeof value === "object" && value !== null) {
      return {
        kind: GridCellKind.Text,
        data: JSON.stringify(value),
        displayData: JSON.stringify(value),
        allowOverlay: false,
        readonly: true,
      };
    } else {
      return {
        kind: GridCellKind.Text,
        data: String(value),
        displayData: String(value),
        allowOverlay: false,
        readonly: true,
      };
    }
  };

  const handlePlay = async () => {
    setIsRunning(!isRunning);

    let app_db =
      "sqlite:///Users/ellie/Library/Application Support/sh.atuin.app/kv.db";

    let res = await runQuery(app_db, q);

    try {
      if (res.lastInsertID || res.rowsAffected) {
        setLastInsertID(res.lastInsertID);
        setRowsAffected(res.rowsAffected);
        setResults(null);
      } else {
        if (!res.results) return;
        if (res.results?.length == 0) return;

        // Turn the columns into GridColumns
        let keys = Object.keys(res.results[0]);

        let columns = keys.map((key) => {
          return {
            id: key,
            title: key,
            width: Math.floor(
              (bodyRef.current?.clientWidth || 0) / keys.length,
            ),
          };
        });

        setColumns(columns);
        setResults(res.results);
      }
    } catch (e: any) {
      console.error(e);
      setError(e);
    }

    setIsRunning(false);
  };

  return (
    <Card
      className="w-full !max-w-full !outline-none overflow-none"
      shadow="sm"
    >
      <CardHeader className="p-3 gap-2">
        <Input
          placeholder="sqlite:///Users/me/file.db"
          label="Database"
          isRequired
          startContent={<DatabaseIcon size={18} />}
        />

        <div className="flex flex-row">
          <button
            className={`flex items-center justify-center flex-shrink-0 w-8 h-8 mr-2 rounded border focus:outline-none focus:ring-2 transition-all duration-300 ease-in-out ${
              isRunning
                ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-300 focus:ring-red-300"
                : "border-green-200 bg-green-50 text-green-600 hover:bg-green-100 hover:border-green-300 focus:ring-green-300"
            }`}
            aria-label={isRunning ? "Stop code" : "Run code"}
            onClick={handlePlay}
          >
            <span
              className={`inline-block transition-transform duration-300 ease-in-out ${isRunning ? "rotate-180" : ""}`}
            >
              {isRunning ? <Square size={16} /> : <Play size={16} />}
            </span>
          </button>
          <CodeMirror
            placeholder={"Write your query here..."}
            className="!pt-0 max-w-full border border-gray-300 rounded flex-grow"
            basicSetup={true}
            value={q}
            onChange={(val) => {
              setQ(val);
            }}
          />
        </div>
      </CardHeader>
      <CardBody className="min-h-64 overflow-x-scroll">
        {rowsAffected != null && lastInsertID != null && (
          <p className="text-sm text-gray-600">
            {rowsAffected} {rowsAffected == 1 ? "row" : "rows"} affected, last
            insert ID: {lastInsertID}
          </p>
        )}

        {error && (
          <div className="bg-red-100 text-red-600 p-2 rounded">{error}</div>
        )}

        <div className="h-64 w-full" ref={bodyRef}>
          {results && (
            <>
              <DataEditor
                className="w-full"
                getCellContent={getCellContent}
                columns={columns}
                rows={results.length}
              />
            </>
          )}
        </div>
      </CardBody>
    </Card>
  );
};

export default createReactBlockSpec(
  {
    type: "sql",
    propSchema: {},
    content: "none",
  },
  {
    // @ts-ignore
    render: ({ block, editor, code, type }) => {
      return <SQL />;
    },
  },
);

export const insertSQL =
  (schema: any) => (editor: typeof schema.BlockNoteEditor) => ({
    title: "SQL",
    onItemClick: () => {
      insertOrUpdateBlock(editor, {
        type: "sql",
      });
    },
    icon: <DatabaseIcon size={18} />,
    aliases: ["sql", "postgres", "sqlite", "mysql"],
    group: "Monitor",
  });
