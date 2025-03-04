// Base for database block implementation
// Intended for databases that have tables
// postgres, sqlite, etc - not document stores.

import { useState } from "react";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  Button,
  DropdownItem,
  ButtonGroup,
  Tooltip,
} from "@heroui/react";
import { ArrowDownToLineIcon, ArrowUpToLineIcon, ChevronDown, DatabaseIcon, RefreshCwIcon } from "lucide-react";
import CodeMirror, { Extension } from "@uiw/react-codemirror";
import { GridColumn } from "@glideapps/glide-data-grid";

import "@glideapps/glide-data-grid/dist/index.css";

// @ts-ignore
import { CardHeader } from "@/components/ui/card";

import { useInterval } from "usehooks-ts";
import PlayButton from "./PlayButton";
import { QueryResult } from "./database";
import SQLResults from "./SQLResults";
import MaskedInput from "@/components/MaskedInput/MaskedInput";
import Block from "./Block";
import { templateString } from "@/state/templates";
import { useBlockNoteEditor } from "@blocknote/react";
import { AtuinState, useStore } from "@/state/store";
import { cn } from "@/lib/utils";
import { logExecution } from "@/lib/exec_log";

interface SQLProps {
  id: string;
  name: string;
  placeholder?: string;
  collapseQuery: boolean;
  extensions?: Extension[];
  eventName?: string;
  isEditable: boolean;
  block: any;

  uri: string;
  query: string;
  autoRefresh: number;
  runQuery: (uri: string, query: string) => Promise<QueryResult>;

  setCollapseQuery: (collapseQuery: boolean) => void;
  setQuery: (query: string) => void;
  setUri: (uri: string) => void;
  setAutoRefresh: (autoRefresh: number) => void;
  setName: (name: string) => void;
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
  id,
  name,
  block,
  setName,
  placeholder,
  query,
  setQuery,
  uri,
  setUri,
  autoRefresh,
  setAutoRefresh,
  collapseQuery,
  setCollapseQuery,
  isEditable,
  runQuery,
  eventName,
  extensions = [],
}: SQLProps) => {
  let editor = useBlockNoteEditor();
  const colorMode = useStore((state) => state.functionalColorMode);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  const [results, setResults] = useState<QueryResult | null>(null);
  const [columns, setColumns] = useState<GridColumn[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [currentRunbookId] = useStore((store: AtuinState) => [store.currentRunbookId]);

  const handlePlay = async () => {
    setIsRunning(true);

    try {
      let tUri = await templateString(id, uri, editor.document, currentRunbookId);
      let tQuery = await templateString(id, query, editor.document, currentRunbookId);

      let startTime = new Date().getTime() * 1000000;
      let res = await runQuery(tUri, tQuery);
      let endTime = new Date().getTime() * 1000000;

      // Don't log the actual data, but log the query and metadata
      let output = {
        query,
        rowCount: res.rows?.length,
      };
      await logExecution(block, block.typeName, startTime, endTime, JSON.stringify(output));

      setIsRunning(false);

      setColumns(columns);
      setResults(res);
      setError(null);
    } catch (e: any) {
      if (e.message) {
        e = e.message;
      }

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
    <Block
      name={name}
      setName={setName}
      header={
        <>
          <MaskedInput
            maskRegex={/(?<=:\/\/)([^@]+)(?=@)/}
            placeholder={placeholder || "protocol://user:password@host:port/db"}
            label="URI"
            isRequired
            startContent={<DatabaseIcon size={18} />}
            value={uri}
            onChange={(val: string) => {
              setUri(val);
            }}
            disabled={!isEditable}
          />

          <div className="flex flex-row gap-2 w-full">
            <PlayButton
              eventName={`${eventName}.run`}
              isRunning={isRunning}
              onPlay={handlePlay}
              cancellable={false}
            />
            <CodeMirror
              placeholder={"Write your query here..."}
              className={cn("!pt-0 max-w-full border border-gray-300 rounded flex-grow", { "h-8 overflow-hidden": collapseQuery })}
              basicSetup={true}
              extensions={[...extensions]}
              value={query}
              onChange={setQuery}
              editable={isEditable}
              theme={colorMode === "dark" ? "dark" : "light"}
              maxHeight="100vh"
            />
          </div>
        </>
      }
      footer={
        <ButtonGroup>
          <Dropdown showArrow>
            <DropdownTrigger>
              <Button
                size="sm"
                variant="flat"
                startContent={<RefreshCwIcon size={16} />}
                endContent={<ChevronDown size={16} />}
              >
                Auto refresh:{" "}
                {autoRefresh == 0
                  ? "Off"
                  : (
                      autoRefreshChoices.find((a) => a.value == autoRefresh) || {
                        label: "Off",
                      }
                    ).label}
              </Button>
            </DropdownTrigger>
            <DropdownMenu variant="faded" aria-label="Select time frame for chart">
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
          <Button
            size="sm"
            isIconOnly
            variant="flat"
            onPress={() => setCollapseQuery(!collapseQuery)}
          >
            <Tooltip content={collapseQuery ? "Expand query" : "Collapse query"}>
              {collapseQuery ? <ArrowDownToLineIcon size={16} /> : <ArrowUpToLineIcon size={16} />}
            </Tooltip>
          </Button>
        </ButtonGroup>
      }
    >
      <SQLResults results={results} error={error} />
    </Block>
  );
};

export default SQL;
