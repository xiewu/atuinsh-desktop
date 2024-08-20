import { useState, useMemo, useEffect } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardFooter,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  ButtonGroup,
} from "@nextui-org/react";

import { ClockIcon, LineChartIcon, RefreshCwIcon } from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";
import { PromQLExtension } from "@prometheus-io/codemirror-promql";
import { PrometheusDriver } from "prometheus-query";
import { useDebounceCallback } from "usehooks-ts";

// @ts-ignore
import { createReactBlockSpec } from "@blocknote/react";

// @ts-ignore
import { insertOrUpdateBlock } from "@blocknote/core";

import { PromLineChart } from "./lineChart";

interface PromProps {
  query: string;
  onChange: (val: string) => void;
}

interface TimeFrame {
  name: string;
  seconds: number;
}

const timeOptions: TimeFrame[] = [
  { name: "Last 5 mins", seconds: 5 * 60 },
  { name: "Last 15 mins", seconds: 15 * 60 },
  { name: "Last 30 mins", seconds: 30 * 60 },
  { name: "Last 1 hr", seconds: 60 * 60 },
  { name: "Last 3 hrs", seconds: 3 * 60 * 60 },
  { name: "Last 6 hrs", seconds: 6 * 60 * 60 },
  { name: "Last 24 hrs", seconds: 24 * 60 * 60 },
  { name: "Last 2 days", seconds: 2 * 24 * 60 * 60 },
  { name: "Last 7 days", seconds: 7 * 24 * 60 * 60 },
  { name: "Last 30 days", seconds: 30 * 24 * 60 * 60 },
  { name: "Last 90 days", seconds: 90 * 24 * 60 * 60 },
];

// map prometheus query time frames (eg last 24hrs) to an ideal step value
const calculateStepSize = (ago: any, maxDataPoints = 11000) => {
  // Calculate the initial step size
  let stepSize = Math.ceil(ago / maxDataPoints);

  // Round up to a "nice" number
  // Don't go below 10s
  const niceNumbers = [10, 15, 30, 60, 300, 600, 900, 1800, 3600];
  for (let i = 0; i < niceNumbers.length; i++) {
    if (stepSize <= niceNumbers[i]) {
      stepSize = niceNumbers[i];
      break;
    }
  }

  // If we've gone through all nice numbers and step is still larger,
  // round up to the nearest hour in seconds
  if (stepSize > 3600) {
    stepSize = Math.ceil(stepSize / 3600) * 3600;
  }

  return stepSize;
};

const Prometheus = ({ query, onChange }: PromProps) => {
  const [value, setValue] = useState<string>(query);
  const [data, setData] = useState<any[]>([]);
  const [config, _setConfig] = useState<{}>({});
  const [timeFrame, setTimeFrame] = useState<TimeFrame>(timeOptions[3]);

  const prom = useMemo(
    () =>
      new PrometheusDriver({
        endpoint: "http://localhost:9090",
        baseURL: "/api/v1", // default value
      }),
    [],
  );

  const runQuery = async (val: any) => {
    const start = new Date().getTime() - timeFrame.seconds * 1000;
    const end = new Date();
    const step = calculateStepSize(timeFrame.seconds);

    const res = await prom.rangeQuery(val, start, end, step);

    const series = res.result;

    // convert promql response to echarts
    let data = series.map((s) => {
      const metric = s.metric;
      const values = s.values;

      return {
        type: "line",
        showSymbol: false,
        name: metric.toString(),
        data: values.map((v: any) => {
          return [v.time, v.value];
        }),
      };
    });

    setData(data);
  };

  useEffect(() => {
    if (!query) return;

    (async () => {
      await runQuery(query);
    })();
  }, [timeFrame]);

  let debouncedRunQuery = useDebounceCallback(runQuery, 500);

  let promql = useMemo(() => {
    let prom = new PromQLExtension().setComplete({
      remote: { url: "http://localhost:9090" },
    });

    return prom;
  }, []);

  return (
    <Card className="w-full resize-y">
      <CardHeader>
        <div className="w-full !max-w-full !outline-none overflow-none flex flex-row">
          <CodeMirror
            placeholder={"Write your query here..."}
            className="!pt-0 max-w-full border border-gray-300 rounded flex-grow"
            value={value}
            onChange={(val) => {
              runQuery(val);
              setValue(val);
              onChange(val);
            }}
            extensions={[promql.asExtension()]}
            basicSetup={true}
          />
        </div>
      </CardHeader>
      <CardBody className="min-h-64 overflow-x-scroll">
        <PromLineChart data={data} config={config} />
      </CardBody>
      <CardFooter>
        <ButtonGroup>
          <Button
            onPress={async () => {
              await debouncedRunQuery(value);
            }}
            variant="flat"
            isIconOnly
            startContent={<RefreshCwIcon />}
          />

          <Dropdown showArrow>
            <DropdownTrigger>
              <Button variant="flat" startContent={<ClockIcon />}>
                {timeFrame.name}
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              variant="faded"
              aria-label="Select time frame for chart"
            >
              {timeOptions.map((timeOption) => {
                return (
                  <DropdownItem
                    key={timeOption.name}
                    onPress={() => {
                      setTimeFrame(timeOption);
                    }}
                  >
                    {timeOption.name}
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
    type: "prometheus",
    propSchema: {
      query: { default: "" },
    },
    content: "none",
  },
  {
    // @ts-ignore
    render: ({ block, editor }) => {
      const onInputChange = (val: string) => {
        console.log("onchange", val, editor);
        editor.updateBlock(block, {
          // @ts-ignore
          props: { ...block.props, query: val },
        });
        console.log(editor.document);
      };

      return <Prometheus query={block.props.query} onChange={onInputChange} />;
    },
  },
);

export const insertPrometheus =
  (schema: any) => (editor: typeof schema.BlockNoteEditor) => ({
    title: "Prometheus",
    onItemClick: () => {
      insertOrUpdateBlock(editor, {
        type: "prometheus",
      });
    },
    icon: <LineChartIcon size={18} />,
    aliases: ["prom", "promql", "grafana"],
    group: "Monitor",
  });
