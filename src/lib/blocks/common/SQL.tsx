// Base for database block implementation
// Intended for databases that have tables
// postgres, sqlite, etc - not document stores.

import { useCallback, useRef, useState } from "react";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  Button,
  DropdownItem,
  ButtonGroup,
  Tooltip,
  DropdownSection,
} from "@heroui/react";
import {
  ArrowDownToLineIcon,
  ArrowUpToLineIcon,
  ChevronDown,
  CloudOffIcon,
  DatabaseIcon,
  FileTerminalIcon,
  LockIcon,
  RefreshCwIcon,
} from "lucide-react";
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
import { cn, toSnakeCase } from "@/lib/utils";
import { logExecution } from "@/lib/exec_log";
import { DependencySpec, useDependencyState } from "@/lib/workflow/dependency";
import { useBlockBusRunSubscription } from "@/lib/hooks/useBlockBus";
import BlockBus from "@/lib/workflow/block_bus";
import useCodemirrorTheme from "@/lib/hooks/useCodemirrorTheme";

interface SQLProps {
  id: string;
  name: string;
  placeholder?: string;
  collapseQuery: boolean;
  extensions?: Extension[];
  sqlType: "sqlite" | "postgres" | "clickhouse"; // explicit SQL type: 'sqlite', 'postgres', 'clickhouse'
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
  setDependency: (dependency: DependencySpec) => void;
  onCodeMirrorFocus?: () => void;
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
  setDependency,
  isEditable,
  runQuery,
  sqlType,
  extensions = [],
  onCodeMirrorFocus,
}: SQLProps) => {
  let editor = useBlockNoteEditor();
  const [isRunning, setIsRunning] = useState<boolean>(false);

  const [results, setResults] = useState<QueryResult | null>(null);
  const [columns, setColumns] = useState<GridColumn[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [currentRunbookId] = useStore((store: AtuinState) => [store.currentRunbookId]);
  const { canRun } = useDependencyState(block, isRunning);
  const elementRef = useRef<HTMLDivElement>(null);

  const themeObj = useCodemirrorTheme();

  const handlePlay = useCallback(async () => {
    console.log("sql handlePlay called");
    setIsRunning(true);

    let startTime = new Date().getTime() * 1000000;
    try {
      let tUri = await templateString(id, uri, editor.document, currentRunbookId);
      let tQuery = await templateString(id, query, editor.document, currentRunbookId);

      if (elementRef.current) {
        elementRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      }

      let res = await runQuery(tUri, tQuery);
      let endTime = new Date().getTime() * 1000000;

      // Don't log the actual data, but log the query and metadata
      let output = {
        query,
        rowCount: res.rows?.length,
      };
      await logExecution(block, block.typeName, startTime, endTime, JSON.stringify(output));
      BlockBus.get().blockFinished(block);

      setIsRunning(false);

      setColumns(columns);
      setResults(res);
      setError(null);
    } catch (e: any) {
      if (e.message) {
        e = e.message;
      }

      let endTime = new Date().getTime() * 1000000;
      await logExecution(block, block.typeName, startTime, endTime, JSON.stringify({ error: e }));
      BlockBus.get().blockFinished(block);

      setError(e);
      setIsRunning(false);
    }
  }, [block, editor.document, currentRunbookId, query, uri, runQuery]);

  useBlockBusRunSubscription(block.id, handlePlay);

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

  const addScriptForUri = () => {
    let blockName = toSnakeCase(name);

    // TODO: register custom schema type for typescript blocknote
    editor.insertBlocks(
      [
        {
          // @ts-ignore
          type: "script",
          props: {
            name: `uri for ${name}`,
            // @ts-ignore
            outputVariable: blockName,
            outputVisible: false,
            code: `# Output the uri for ${name}`,
          },
        },
      ],
      id,
      "before",
    );

    setUri(`{{ var.${blockName} }}`);
  };

  const addLocalVar = () => {
    let blockName = toSnakeCase(name);

    editor.insertBlocks(
      [
        {
          // @ts-ignore
          type: "local-var",
          props: {
            name: `${blockName}`,
          },
        },
      ],
      id,
      "before",
    );

    setUri(`{{ var.${blockName} }}`);
  };

  return (
    <Block
      hasDependency
      name={name}
      block={block}
      setDependency={setDependency}
      type={block.typeName}
      setName={setName}
      header={
        <>
          <div className="flex flex-row gap-2 w-full items-center">
            <MaskedInput
              size="sm"
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

            <Dropdown>
              <DropdownTrigger>
                <Button isIconOnly variant="flat">
                  <LockIcon size={16} />
                </Button>
              </DropdownTrigger>
              <DropdownMenu disabledKeys={["secret"]}>
                <DropdownSection title="Use a local variable or script">
                  <DropdownItem
                    key="local-var"
                    description="Local variable - not synced"
                    startContent={<CloudOffIcon size={16} />}
                    onPress={addLocalVar}
                  >
                    Variable
                  </DropdownItem>
                  <DropdownItem
                    key="template"
                    description="Shell command output"
                    startContent={<FileTerminalIcon size={16} />}
                    onPress={addScriptForUri}
                  >
                    Script
                  </DropdownItem>
                  <DropdownItem
                    key="secret"
                    description="Synchronized + encrypted secret"
                    startContent={<LockIcon size={16} />}
                  >
                    Secret
                  </DropdownItem>
                </DropdownSection>
              </DropdownMenu>
            </Dropdown>
          </div>

          <div className="flex flex-row gap-2 w-full" ref={elementRef}>
            <PlayButton
              disabled={!canRun}
              eventName="runbooks.block.execute"
              eventProps={{ type: sqlType }}
              isRunning={isRunning}
              onPlay={handlePlay}
              cancellable={false}
            />
            <CodeMirror
              placeholder={"Write your query here..."}
              className={cn("!pt-0 max-w-full border border-gray-300 rounded flex-grow", {
                "h-8 overflow-hidden": collapseQuery,
              })}
              basicSetup={true}
              extensions={[...extensions]}
              value={query}
              onChange={setQuery}
              editable={isEditable}
              theme={themeObj}
              maxHeight="100vh"
              onFocus={onCodeMirrorFocus}
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
      {(results || error) && (
        <SQLResults
          results={results}
          error={error}
          dismiss={() => {
            setResults(null);
            setError(null);
          }}
        />
      )}
    </Block>
  );
};

export default SQL;
