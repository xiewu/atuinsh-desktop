// Base for database block implementation
// Intended for databases that have tables
// postgres, sqlite, etc - not document stores.

import { useState } from "react";
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
import { ChevronDown, DatabaseIcon, RefreshCwIcon } from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";
import { GridColumn } from "@glideapps/glide-data-grid";

import "@glideapps/glide-data-grid/dist/index.css";

// @ts-ignore
import { CardHeader } from "@/components/ui/card";

import { useInterval } from "usehooks-ts";
import PlayButton from "./PlayButton";
import { QueryResult } from "./database";
import SQLResults from "./SQLResults";

interface SQLProps {
  name?: string;
  placeholder?: string;
  eventName?: string;

  uri: string;
  query: string;
  autoRefresh: number;
  runQuery: (uri: string, query: string) => Promise<QueryResult>;

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
  name,
  placeholder,
  query,
  setQuery,
  uri,
  setUri,
  autoRefresh,
  setAutoRefresh,
  runQuery,
  eventName,
}: SQLProps) => {
  const [isRunning, setIsRunning] = useState<boolean>(false);

  const [results, setResults] = useState<QueryResult | null>(null);
  const [columns, setColumns] = useState<GridColumn[]>([]);

  const [error, setError] = useState<string | null>(null);

  const handlePlay = async () => {
    setIsRunning(true);

    try {
      let res = await runQuery(uri, query);

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
    <Card
      className="w-full !max-w-full !outline-none overflow-none"
      shadow="sm"
    >
      <CardHeader className="p-3 gap-2 bg-default-50">
        {name && <span className="text-default-700 font-semibold">{name}</span>}
        <Input
          placeholder={placeholder || "protocol://user:password@host:port/db"}
          label="URI"
          isRequired
          startContent={<DatabaseIcon size={18} />}
          value={uri}
          onValueChange={(val) => {
            setUri(val);
          }}
        />

        <div className="flex flex-row gap-2">
          <PlayButton
            eventName={`${eventName}.run`}
            isRunning={isRunning}
            onPlay={handlePlay}
            cancellable={false}
          />
          <CodeMirror
            placeholder={"Write your query here..."}
            className="!pt-0 max-w-full border border-gray-300 rounded flex-grow"
            basicSetup={true}
            value={query}
            onChange={setQuery}
          />
        </div>
      </CardHeader>
      <CardBody className="overflow-x-scroll">
        <SQLResults results={results} error={error} />
      </CardBody>
      <CardFooter>
        <ButtonGroup>
          <Dropdown showArrow>
            <DropdownTrigger>
              <Button
                size="sm"
                variant="bordered"
                startContent={<RefreshCwIcon size={16} />}
                endContent={<ChevronDown size={16} />}
              >
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

export default SQL;
