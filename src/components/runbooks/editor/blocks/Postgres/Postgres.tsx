import { useRef, useState } from "react";
import {
  Input,
  Card,
  CardBody,
  CardFooter,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  Button,
  DropdownItem,
  ButtonGroup,
} from "@nextui-org/react";
import { DatabaseIcon, Play, RefreshCwIcon, Square } from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";
import { GridColumn } from "@glideapps/glide-data-grid";

import "@glideapps/glide-data-grid/dist/index.css";

// @ts-ignore
import { createReactBlockSpec } from "@blocknote/react";
import { insertOrUpdateBlock } from "@blocknote/core";
import { CardHeader } from "@/components/ui/card";

import { runQuery } from "./query";
import { useInterval } from "usehooks-ts";
import ResultTable from "../common/ResultTable";

interface SQLProps {
  uri: string;
  query: string;
  autoRefresh: number;

  setQuery: (query: string) => void;
  setUri: (uri: string) => void;
  setAutoRefresh: (autoRefresh: number) => void;
}

const autoRefreshChoices = [
  { label: "Off", value: 0 },
  { label: "1s", value: 1000 },
  { label: "5s", value: 5000 },
  { label: "10s", value: 10000 },
  { label: "30s", value: 30000 },
  { label: "1m", value: 60000 },
  { label: "2m", value: 120000 },
  { label: "5m", value: 300000 },
  { label: "10m", value: 600000 },
  { label: "30m", value: 1800000 },
];

const SQL = ({
  query,
  setQuery,
  uri,
  setUri,
  autoRefresh,
  setAutoRefresh,
}: SQLProps) => {
  const [isRunning, setIsRunning] = useState<boolean>(false);

  const [lastInsertID, setLastInsertID] = useState<number | null>(null);
  const [rowsAffected, setRowsAffected] = useState<number | null>(null);

  const [results, setResults] = useState<any[] | null>(null);
  const [columns, setColumns] = useState<GridColumn[]>([]);

  const [error, setError] = useState<string | null>(null);

  const bodyRef = useRef<HTMLDivElement>(null);

  const handlePlay = async () => {
    setIsRunning(true);

    try {
      let res = await runQuery(uri, query);

      setIsRunning(false);

      if (res.lastInsertID || res.rowsAffected) {
        setLastInsertID(res.lastInsertID);
        setRowsAffected(res.rowsAffected);
        setResults(null);
      } else {
        if (!res.rows) return;
        if (res.rows?.length == 0) return;
        if (!res.columns) return;

        let columns = res.columns.map((key: any) => {
          return {
            id: key.name,
            title: key.name,
            grow: 1,
            width: Math.floor(
              (bodyRef.current?.clientWidth || 0) / res.columns!.length,
            ),
          };
        });

        setColumns(columns);
        setResults(res.rows);
      }
    } catch (e: any) {
      console.error(e);
      setError(e);
      setIsRunning(false);
    }
  };

  useInterval(
    () => {
      // let's not stack queries
      if (isRunning) return;

      (async () => {
        await handlePlay();
      })();
    },
    autoRefresh > 0 ? autoRefresh : null,
  );

  return (
    <Card
      className="w-full !max-w-full !outline-none overflow-none"
      shadow="sm"
    >
      <CardHeader className="p-3 gap-2">
        <Input
          placeholder="postgres://user:password@localhost:5432/dbname"
          label="Database"
          isRequired
          startContent={<DatabaseIcon size={18} />}
          value={uri}
          onValueChange={(val) => {
            setUri(val);
          }}
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
            value={query}
            onChange={setQuery}
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
              <ResultTable
                columns={columns}
                results={results}
                setColumns={setColumns}
              />
            </>
          )}
        </div>
      </CardBody>
      <CardFooter>
        <ButtonGroup>
          <Dropdown showArrow>
            <DropdownTrigger>
              <Button variant="flat" startContent={<RefreshCwIcon />}>
                Auto refresh:{" "}
                {autoRefresh == 0
                  ? "Off"
                  : (
                      autoRefreshChoices.find(
                        (a) => a.value == autoRefresh,
                      ) || {
                        label: "Off",
                      }
                    ).label}
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              variant="faded"
              aria-label="Select time frame for chart"
            >
              {autoRefreshChoices.map((setting) => {
                return (
                  <DropdownItem
                    key={setting.label}
                    onPress={() => {
                      setAutoRefresh(setting.value);
                    }}
                  >
                    {setting.label}
                  </DropdownItem>
                );
              })}
            </DropdownMenu>
          </Dropdown>
        </ButtonGroup>
      </CardFooter>
    </Card>
  );
};

export default createReactBlockSpec(
  {
    type: "postgres",
    propSchema: {
      query: { default: "" },
      uri: { default: "" },
      autoRefresh: { default: 0 },
    },
    content: "none",
  },
  {
    // @ts-ignore
    render: ({ block, editor, code, type }) => {
      const setQuery = (query: string) => {
        editor.updateBlock(block, {
          // @ts-ignore
          props: { ...block.props, query: query },
        });
      };

      const setUri = (uri: string) => {
        editor.updateBlock(block, {
          // @ts-ignore
          props: { ...block.props, uri: uri },
        });
      };

      const setAutoRefresh = (autoRefresh: number) => {
        editor.updateBlock(block, {
          // @ts-ignore
          props: { ...block.props, autoRefresh: autoRefresh },
        });
      };

      return (
        <SQL
          query={block.props.query}
          uri={block.props.uri}
          setUri={setUri}
          setQuery={setQuery}
          autoRefresh={block.props.autoRefresh}
          setAutoRefresh={setAutoRefresh}
        />
      );
    },
  },
);

export const insertPostgres =
  (schema: any) => (editor: typeof schema.BlockNoteEditor) => ({
    title: "PostgreSQL",
    onItemClick: () => {
      insertOrUpdateBlock(editor, {
        type: "postgres",
      });
    },
    icon: <DatabaseIcon size={18} />,
    group: "Database",
  });
