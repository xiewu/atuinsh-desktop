import { useState, useEffect } from "react";
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
  Spinner,
  Switch,
} from "@nextui-org/react";

import { ClockIcon, LineChartIcon, RefreshCwIcon } from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";
import { PromQLExtension } from "@prometheus-io/codemirror-promql";
import { PrometheusDriver } from "prometheus-query";
import { useDebounceCallback, useInterval } from "usehooks-ts";

// @ts-ignore
import { createReactBlockSpec } from "@blocknote/react";

// @ts-ignore
import { insertOrUpdateBlock } from "@blocknote/core";

import { PromLineChart } from "./lineChart";
import PromSettings, { PrometheusConfig } from "./promSettings";
import { Settings } from "@/state/settings";
import ErrorCard from "../common/ErrorCard";

interface PromProps {
  query: string;
  endpoint: string;
  autoRefresh: boolean;
  period: string;

  onPropsChange: (val: any) => void;
}

interface TimeFrame {
  name: string;
  seconds: number;
  short: string;
}

const timeOptions: TimeFrame[] = [
  { name: "Last 5 mins", seconds: 5 * 60, short: "5m" },
  { name: "Last 15 mins", seconds: 15 * 60, short: "15m" },
  { name: "Last 30 mins", seconds: 30 * 60, short: "30m" },
  { name: "Last 1 hr", seconds: 60 * 60, short: "1h" },
  { name: "Last 3 hrs", seconds: 3 * 60 * 60, short: "3h" },
  { name: "Last 6 hrs", seconds: 6 * 60 * 60, short: "6h" },
  { name: "Last 24 hrs", seconds: 24 * 60 * 60, short: "24h" },
  { name: "Last 2 days", seconds: 2 * 24 * 60 * 60, short: "2d" },
  { name: "Last 7 days", seconds: 7 * 24 * 60 * 60, short: "7d" },
  { name: "Last 30 days", seconds: 30 * 24 * 60 * 60, short: "30d" },
  { name: "Last 90 days", seconds: 90 * 24 * 60 * 60, short: "90d" },
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

const Prometheus = (props: PromProps) => {
  const [value, setValue] = useState<string>(props.query);
  const [data, setData] = useState<any[]>([]);
  const [config, _setConfig] = useState<{}>({});
  const [timeFrame, setTimeFrame] = useState<TimeFrame>(
    timeOptions.find((t) => t.short === props.period) || timeOptions[3],
  );
  const [autoRefresh, setAutoRefresh] = useState<boolean>(props.autoRefresh);

  const [prometheusUrl, setPrometheusUrl] = useState<string | null>(null);
  const [promClient, setPromClient] = useState<PrometheusDriver | null>(null);
  const [promExtension, setPromExtension] = useState<PromQLExtension | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const runQuery = async (val: any) => {
    if (!promClient) return;

    const start = new Date().getTime() - timeFrame.seconds * 1000;
    const end = new Date();
    const step = calculateStepSize(timeFrame.seconds);

    const res = await promClient.rangeQuery(val, start, end, step);

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
    (async () => {
      // if have passed in an endpoint via props directly, use it
      if (props.endpoint) {
        setPrometheusUrl(props.endpoint);
        return;
      }

      // otherwise fetch the default endpoint from settings
      let url = await Settings.runbookPrometheusUrl();

      setPrometheusUrl(url);
    })();
  }, []);

  useEffect(() => {
    if (!prometheusUrl) return;

    let prom = new PrometheusDriver({
      endpoint: prometheusUrl,
      baseURL: "/api/v1", // default value
    });

    let promExt = new PromQLExtension().setComplete({
      remote: { url: prometheusUrl },
    });

    setPromClient(prom);
    setPromExtension(promExt);
  }, [prometheusUrl]);

  useEffect(() => {
    if (!props.query) return;

    (async () => {
      try {
        await runQuery(props.query);
        setError(null);
      } catch (e: any) {
        setError(JSON.stringify(e));
      }
    })();
  }, [timeFrame, promClient]);

  let debouncedRunQuery = useDebounceCallback(runQuery, 500);

  useInterval(
    () => {
      (async () => {
        await runQuery(value);
      })();
    },
    autoRefresh ? 5000 : null,
  );

  if (!prometheusUrl || !promClient || !promExtension) {
    return (
      <Card className="w-full resize-y justify-center align-middle h-52">
        <Spinner />
      </Card>
    );
  }

  return (
    <Card
      className="w-full !max-w-full !outline-none overflow-none"
      shadow="sm"
    >
      <CardHeader>
        <div className="w-full !max-w-full !outline-none overflow-none flex flex-row">
          <CodeMirror
            placeholder={"Write your query here..."}
            className="!pt-0 max-w-full border border-gray-300 rounded flex-grow"
            value={value}
            onChange={(val) => {
              debouncedRunQuery(val);
              setValue(val);
              props.onPropsChange({ query: val });
            }}
            extensions={[promExtension.asExtension()]}
            basicSetup={true}
          />
        </div>
      </CardHeader>
      <CardBody className="min-h-64 overflow-x-scroll">
        {error && <ErrorCard error={error} />}
        {!error && <PromLineChart data={data} config={config} />}
      </CardBody>
      <CardFooter className="justify-between">
        <div>
          <ButtonGroup className="mr-2">
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
                        props.onPropsChange({ period: timeOption.short });
                      }}
                    >
                      {timeOption.name}
                    </DropdownItem>
                  );
                })}
              </DropdownMenu>
            </Dropdown>
          </ButtonGroup>

          <Switch
            isSelected={autoRefresh}
            onValueChange={(value) => {
              setAutoRefresh(value);
              props.onPropsChange({ autoRefresh: value });
            }}
          >
            <h3 className="text-sm">Auto refresh</h3>
          </Switch>
        </div>

        <PromSettings
          config={{
            endpoint: prometheusUrl,
          }}
          onSave={(config: PrometheusConfig) => {
            if (config.endpoint) setPrometheusUrl(config.endpoint);

            if (config.endpoint != props.endpoint) {
              props.onPropsChange({ endpoint: config.endpoint });
            }
          }}
        />
      </CardFooter>
    </Card>
  );
};

export default createReactBlockSpec(
  {
    type: "prometheus",
    propSchema: {
      query: { default: "" },
      endpoint: { default: "" },
      period: { default: "" },
      autoRefresh: { default: false },
    },
    content: "none",
  },
  {
    // @ts-ignore
    render: ({ block, editor }) => {
      const onPropsChange = (props: any) => {
        editor.updateBlock(block, {
          // @ts-ignore
          props: { ...block.props, ...props },
        });
      };

      return (
        <Prometheus
          query={block.props.query}
          endpoint={block.props.endpoint}
          period={block.props.period}
          autoRefresh={block.props.autoRefresh}
          onPropsChange={onPropsChange}
        />
      );
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
