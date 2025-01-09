import {
  Button,
  Tooltip,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  DropdownSection,
} from "@nextui-org/react";
import {
  ChevronRightIcon,
  Import,
  MoreVertical,
  Plus,
  RefreshCwIcon,
  SearchIcon,
  Terminal,
} from "lucide-react";
import { DateTime } from "luxon";
import Runbook from "@/state/runbooks/runbook";
import { AtuinState, useStore } from "@/state/store";
import { ptyForRunbook, PtyMetadata, usePtyStore } from "@/state/ptyStore";
import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import track_event from "@/tracking";
import { cn } from "@/lib/utils";
import MoveToRunbookDropdown from "./MoveToRunbookDropdown";
import ExportAsRunbookDropdown from "./ExportAsRunbookDropdown";
import { useCurrentRunbook } from "@/lib/useRunbook";
import SyncManager from "@/lib/sync/sync_manager";
import { PendingInvitations } from "./PendingInvitations";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { allRunbooks, allRunbooksIds, runbooksByWorkspaceId } from "@/lib/queries/runbooks";

const NoteSidebar = () => {
  const refreshRunbooks = useStore((state: AtuinState) => state.refreshRunbooks);
  const importRunbook = useStore((state: AtuinState) => state.importRunbook);
  const isSyncing = useStore((state: AtuinState) => state.isSyncing);
  const [isSearchOpen, setSearchOpen] = useStore((store: AtuinState) => [
    store.searchOpen,
    store.setSearchOpen,
  ]);
  const currentRunbook = useCurrentRunbook();
  const currentWorkspaceId = useStore((state: AtuinState) => state.currentWorkspaceId);

  const setCurrentRunbookId = useStore((state: AtuinState) => state.setCurrentRunbookId);
  const ptys: { [pid: string]: PtyMetadata } = usePtyStore((state) => state.ptys);

  const [isMoveToOpen, setMoveToOpen] = useState(false);
  const [isExportAsOpen, setExportAsOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleNewRunbook = async () => {
    window.getSelection()?.removeAllRanges();

    await Runbook.createUntitled(currentWorkspaceId);
    queryClient.invalidateQueries(runbooksByWorkspaceId(currentWorkspaceId));
    queryClient.invalidateQueries(allRunbooks());
    queryClient.invalidateQueries(allRunbooksIds());

    track_event("runbooks.create", {
      total: await Runbook.count(),
    });
  };

  const handleImportRunbook = async () => {
    let runbooks = await importRunbook();

    if (!runbooks) return;
    if (runbooks.length === 0) return;

    setCurrentRunbookId(runbooks[0].id);
  };

  const handleOpenSearch = async () => {
    if (!isSearchOpen) setSearchOpen(true);
  };

  function handleSync() {
    SyncManager.get(useStore).startSync();
  }

  const { data: runbooks } = useQuery(runbooksByWorkspaceId(currentWorkspaceId));

  // sort runbooks alphabetically by name
  const sortedRunbooks = useMemo(() => {
    return (runbooks || []).sort((a, b) => a.name.localeCompare(b.name));
  }, [runbooks]);

  return (
    <div className="!w-64 !max-w-64 !min-w-64 h-full bg-gray-50 border-r border-gray-200 flex flex-col select-none">
      <PendingInvitations />
      <div className="p-2 flex justify-between items-center border-b border-gray-200">
        <h2 className="text-lg font-semibold">Runbooks</h2>
        <div className="flex space-x-1">
          <Tooltip content="New">
            <Button isIconOnly size="sm" variant="light" onPress={handleNewRunbook}>
              <Plus size={18} />
            </Button>
          </Tooltip>

          <Tooltip content="Import">
            <Button isIconOnly size="sm" variant="light" onPress={handleImportRunbook}>
              <Import size={18} />
            </Button>
          </Tooltip>

          <Tooltip content="Search">
            <Button isIconOnly size="sm" variant="light" onPress={handleOpenSearch}>
              <SearchIcon size={18} />
            </Button>
          </Tooltip>

          <Tooltip content={isSyncing ? "Syncing..." : "Sync"}>
            <div>
              {isSyncing && <div />}
              <Button
                isIconOnly
                size="sm"
                variant="light"
                onPress={handleSync}
                isDisabled={isSyncing}
              >
                <RefreshCwIcon
                  size={18}
                  className={isSyncing ? "animate-spinner-linear-spin duration-1000" : ""}
                />
              </Button>
            </div>
          </Tooltip>
        </div>
      </div>
      <div className="flex-grow overflow-y-auto">
        {sortedRunbooks.map((runbook: Runbook) => {
          const count = Object.values(ptys).filter((pty) => pty.runbook === runbook.id).length;
          const isActive =
            currentRunbook && currentRunbook.id === runbook.id && location.pathname === "/runbooks";

          return (
            <div
              key={runbook.id}
              onClick={async () => {
                track_event("runbooks.open", {
                  total: await Runbook.count(),
                });

                if (location.pathname !== "/runbooks") {
                  navigate("/runbooks");
                }
                setCurrentRunbookId(runbook.id);
              }}
              className={`cursor-pointer p-2 border-b border-gray-200 hover:bg-gray-100 ${isActive ? "bg-gray-200" : ""} relative`}
            >
              <div className="flex justify-between items-start">
                <div
                  className={cn("flex-grow mr-2", {
                    "!max-w-[10.5rem]": count > 0,
                  })}
                >
                  <h3 className="font-medium text-sm truncate text-ellipsis">
                    {!runbook.viewed_at && (
                      <div className="rounded-lg bg-blue-500 w-2 h-2 inline-block mr-1 mb-[1px]" />
                    )}
                    {runbook.name || "Untitled"}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {DateTime.fromJSDate(runbook.updated).toLocaleString(DateTime.DATETIME_SHORT)}
                  </p>
                </div>
                <div className="flex items-center">
                  {count > 0 && (
                    <Tooltip content={`${count} active terminal${count > 1 ? "s" : ""}`}>
                      <div className="flex items-center text-primary-500 mr-1">
                        <Terminal size={14} />
                        <span className="text-xs ml-1">{count}</span>
                      </div>
                    </Tooltip>
                  )}
                  <Dropdown>
                    <DropdownTrigger>
                      <Button isIconOnly size="sm" variant="light">
                        <MoreVertical size={16} />
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu aria-label="Runbook actions">
                      <DropdownSection showDivider title="Actions">
                        <DropdownItem
                          key="export"
                          onPointerEnter={() => {
                            setExportAsOpen(true);
                            setMoveToOpen(false);
                          }}
                          onPointerLeave={() => setExportAsOpen(false)}
                          endContent={<ChevronRightIcon size={16} />}
                        >
                          <ExportAsRunbookDropdown
                            runbook={runbook}
                            isOpen={isExportAsOpen}
                            onClose={() => setExportAsOpen(false)}
                          />
                        </DropdownItem>

                        <DropdownItem
                          key="move"
                          onPointerEnter={() => {
                            setMoveToOpen(true);
                            setExportAsOpen(false);
                          }}
                          onPointerLeave={() => setMoveToOpen(false)}
                          endContent={<ChevronRightIcon size={16} />}
                        >
                          <MoveToRunbookDropdown
                            runbook={runbook}
                            isOpen={isMoveToOpen}
                            onClose={() => setMoveToOpen(false)}
                          />
                        </DropdownItem>
                      </DropdownSection>

                      <DropdownSection title="Danger">
                        <DropdownItem
                          key="kill"
                          isDisabled={count === 0}
                          className="text-danger"
                          color="danger"
                          onPress={() =>
                            ptyForRunbook(runbook.id).forEach((pty) =>
                              invoke("pty_kill", { pid: pty.pid }),
                            )
                          }
                        >
                          Kill all terminals
                        </DropdownItem>

                        <DropdownItem
                          key="delete"
                          className="text-danger"
                          color="danger"
                          onPress={async () => {
                            await Runbook.delete(runbook.id);
                            if (currentRunbook && runbook.id === currentRunbook.id)
                              setCurrentRunbookId(null);
                            refreshRunbooks();
                          }}
                        >
                          Delete
                        </DropdownItem>
                      </DropdownSection>
                    </DropdownMenu>
                  </Dropdown>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default NoteSidebar;
