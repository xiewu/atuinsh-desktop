import React, { useEffect, useState } from "react";
import { Tooltip as ReactTooltip } from "react-tooltip";

import { AtuinState, useStore } from "@/state/store";
import { getVersion } from "@tauri-apps/api/app";
import { Card, CardHeader, CardBody, Listbox, ListboxItem } from "@heroui/react";

import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import { ChartConfig, ChartContainer } from "@/components/ui/chart";

import { Clock, Terminal, UsersIcon } from "lucide-react";

import ActivityCalendar from "react-activity-calendar";
import HistoryRow from "@/components/history/HistoryRow";
import { ShellHistory } from "@/state/models";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { allRunbooks, allRunbooksIds, runbooksByWorkspaceId } from "@/lib/queries/runbooks";
import Runbook from "@/state/runbooks/runbook";

function StatCard({ name, stat }: any) {
  return (
    <Card shadow="sm">
      <CardHeader>
        <h3 className="uppercase text-gray-500 dark:text-gray-400">{name}</h3>
      </CardHeader>
      <CardBody>
        <h2 className="font-bold text-xl dark:text-gray-300">{stat}</h2>
      </CardBody>
    </Card>
  );
}

function TopChart({ chartData }: any) {
  const colorMode = useStore((state) => state.colorMode);

  const chartConfig = {
    command: {
      label: "Command",
      color: colorMode === "dark" ? "#66aaf9" : "#c4edde",
    },
  } satisfies ChartConfig;

  return (
    <ChartContainer config={chartConfig} className="max-h-72">
      <BarChart
        accessibilityLayer
        data={chartData}
        layout="vertical"
        margin={{
          right: 16,
        }}
      >
        <CartesianGrid horizontal={false} />
        <YAxis
          dataKey="command"
          type="category"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
          tickFormatter={(value) => value.slice(0, 3)}
          hide
        />
        <XAxis dataKey="count" type="number" hide />
        <Bar dataKey="count" layout="vertical" fill={chartConfig.command.color} radius={4}>
          <LabelList
            dataKey="command"
            position="insideLeft"
            offset={8}
            className="fill-[--color-label]"
            fontSize={12}
          />
          <LabelList
            dataKey="count"
            position="right"
            offset={8}
            className="fill-foreground"
            fontSize={12}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

const explicitTheme = {
  light: ["#f0f0f0", "#c4edde", "#7ac7c4", "#f73859", "#384259"],
  dark: ["#27272a", "#002e62", "#005bc4", "#338ef7", "#66aaf9"],
};

export default function Home() {
  const navigate = useNavigate();
  const homeInfo = useStore((state: AtuinState) => state.homeInfo);
  const calendar = useStore((state: AtuinState) => state.calendar);
  const weekStart = useStore((state: AtuinState) => state.weekStart);
  const colorMode = useStore((state: AtuinState) => state.colorMode);

  const refreshHomeInfo = useStore((state: AtuinState) => state.refreshHomeInfo);
  const refreshUser = useStore((state: AtuinState) => state.refreshUser);
  const refreshCalendar = useStore((state: AtuinState) => state.refreshCalendar);
  const refreshRunbooks = useStore((state: AtuinState) => state.refreshRunbooks);
  const currentWorkspaceId = useStore((state: AtuinState) => state.currentWorkspaceId);
  const setCurrentRunbookId = useStore((state: AtuinState) => state.setCurrentRunbookId);

  const [version, setVersion] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { data: runbooks } = useQuery(allRunbooks());

  useEffect(() => {
    refreshHomeInfo();
    refreshUser();
    refreshCalendar();
    refreshRunbooks();

    let setup = async () => {
      let ver = await getVersion();
      setVersion(ver);
    };

    setup();
  }, []);

  if (!homeInfo || !calendar.length) {
    return <div>Loading...</div>;
  }

  let colorScheme = colorMode === "dark" ? "dark" : "light";

  return (
    <div className="w-full flex-1 flex-col p-4 overflow-y-auto select-none">
      <div className="p-10 grid grid-cols-4 gap-4">
        <StatCard name="Total Commands" stat={homeInfo.historyCount.toLocaleString()} />
        <StatCard name="Total Runbooks" stat={(runbooks || []).length.toLocaleString()} />
        <StatCard name="Version" stat={version} />

        <Card shadow="sm" className="col-span-3">
          <CardHeader>
            <h2 className="uppercase text-gray-500">Activity graph</h2>
          </CardHeader>
          <CardBody>
            <ActivityCalendar
              hideTotalCount
              theme={explicitTheme}
              colorScheme={colorScheme as any}
              data={calendar}
              weekStart={weekStart as any}
              renderBlock={(block, activity) =>
                React.cloneElement(block, {
                  "data-tooltip-id": "react-tooltip",
                  "data-tooltip-html": `${activity.count} commands on ${activity.date}`,
                })
              }
            />
            <ReactTooltip id="react-tooltip" />
          </CardBody>
        </Card>

        <Card shadow="sm">
          <CardHeader>
            <h2 className="uppercase text-gray-500">Quick actions </h2>
          </CardHeader>

          <CardBody>
            <Listbox variant="flat" aria-label="Quick actions">
              <ListboxItem
                key="new-runbook"
                description="Create an executable runbook"
                startContent={<Terminal />}
                onPress={async () => {
                  const rb = await Runbook.createUntitled(currentWorkspaceId);
                  setCurrentRunbookId(rb.id);
                  queryClient.invalidateQueries(runbooksByWorkspaceId(currentWorkspaceId));
                  queryClient.invalidateQueries(allRunbooks());
                  queryClient.invalidateQueries(allRunbooksIds());
                  navigate("/runbooks");
                }}
              >
                New runbook
              </ListboxItem>
              <ListboxItem
                key="shell-history"
                description="Search and explore shell history"
                startContent={<Clock />}
                onPress={() => navigate("/history")}
              >
                Shell History
              </ListboxItem>
              <ListboxItem
                key="community"
                description="Join the community"
                startContent={<UsersIcon />}
                href={"https://dub.sh/atuin-desktop-beta"}
                target="_blank"
              >
                Community
              </ListboxItem>
            </Listbox>
          </CardBody>
        </Card>

        <Card shadow="sm" className="col-span-2">
          <CardHeader>
            <h2 className="uppercase text-gray-500">Recent commands</h2>
          </CardHeader>
          <CardBody>
            {homeInfo.recentCommands?.map((i: ShellHistory) => {
              return <HistoryRow compact drawer key={i.id} h={i} />;
            })}
          </CardBody>
        </Card>

        <Card shadow="sm" className="col-span-2">
          <CardHeader>
            <h2 className="uppercase text-gray-500">Top commands</h2>
          </CardHeader>
          <CardBody>
            <TopChart chartData={homeInfo.topCommands} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
