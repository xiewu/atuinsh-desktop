import { useContext, useEffect, useState } from "react";

import { AtuinState, useStore } from "@/state/store";
import { getVersion } from "@tauri-apps/api/app";
import { Card, CardHeader, CardBody, Listbox, ListboxItem } from "@heroui/react";

import { Clock, Terminal, UsersIcon } from "lucide-react";

import HistoryRow from "@/components/history/HistoryRow";
import { ShellHistory } from "@/state/models";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { allRunbooks } from "@/lib/queries/runbooks";
import Runbook from "@/state/runbooks/runbook";
import RunbookContext from "@/context/runbook_context";
import Workspace from "@/state/runbooks/workspace";
import ActivityGraph from "@/components/ActivityGraph/ActivityGraph";
import TopChart from "@/components/TopCommands/TopCommands";

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

export default function Home() {
  const navigate = useNavigate();
  const homeInfo = useStore((state: AtuinState) => state.homeInfo);
  const calendar = useStore((state: AtuinState) => state.calendar);
  const weekStart = useStore((state: AtuinState) => state.weekStart);
  const colorMode = useStore((state: AtuinState) => state.functionalColorMode);

  const refreshHomeInfo = useStore((state: AtuinState) => state.refreshHomeInfo);
  const refreshUser = useStore((state: AtuinState) => state.refreshUser);
  const refreshCalendar = useStore((state: AtuinState) => state.refreshCalendar);
  const refreshRunbooks = useStore((state: AtuinState) => state.refreshRunbooks);
  const currentWorkspaceId = useStore((state: AtuinState) => state.currentWorkspaceId);
  const { activateRunbook, runbookCreated } = useContext(RunbookContext);

  const [version, setVersion] = useState<string | null>(null);

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
            <ActivityGraph calendar={calendar} weekStart={weekStart} colorMode={colorMode} />
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
                  const ws = await Workspace.get(currentWorkspaceId);
                  if (!ws) return;

                  const rb = await Runbook.createUntitled(ws);
                  runbookCreated(rb.id, ws.get("id")!, null);
                  activateRunbook(rb.id);
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
