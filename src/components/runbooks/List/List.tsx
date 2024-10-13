import {
  Button,
  Tooltip,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  DropdownSection,
} from "@nextui-org/react";
import { ChevronRightIcon, Import, MoreVertical, Plus, SearchIcon, Terminal } from "lucide-react";
import { DateTime } from "luxon";
import Runbook from "@/state/runbooks/runbook";
import { AtuinState, useStore } from "@/state/store";
import { open } from "@tauri-apps/plugin-dialog";
import { ptyForRunbook, PtyMetadata, usePtyStore } from "@/state/ptyStore";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import welcome from "./welcome.json";
import track_event from "@/tracking";
import { cn } from "@/lib/utils";
import MoveRunbookDropdown from "./MoveRunbookDropdown";

const NoteSidebar = () => {
  const runbooks = useStore((state: AtuinState) => state.runbooks);
  const refreshRunbooks = useStore(
    (state: AtuinState) => state.refreshRunbooks,
  );
  const currentRunbook = useStore((state: AtuinState) => state.currentRunbook);
  const newRunbook = useStore((state: AtuinState) => state.newRunbook);
  const [isSearchOpen, setSearchOpen] = useStore((store: AtuinState) => [
    store.searchOpen,
    store.setSearchOpen,
  ]);

  const setCurrentRunbook = useStore(
    (state: AtuinState) => state.setCurrentRunbook,
  );
  const ptys: { [pid: string]: PtyMetadata } = usePtyStore(
    (state) => state.ptys,
  );

  const [isMoveToOpen, setMoveToOpen] = useState(false);

  useEffect(() => {
    refreshRunbooks();

    (async () => {
      if ((await Runbook.count()) === 0) {
        let runbook = await Runbook.create();

        runbook.name = "Welcome to Atuin!";
        runbook.content = JSON.stringify(welcome);
        runbook.save();

        refreshRunbooks();
        setCurrentRunbook(runbook.id);
      }
    })();
  }, []);

  const handleNewRunbook = async () => {
    window.getSelection()?.removeAllRanges();

    newRunbook();

    track_event("runbooks.create", {
      total: await Runbook.count(),
    });
  };

  const handleImportRunbook = async () => {
    let filePath = await open({ multiple: false, directory: false });
    if (!filePath) return;
    let runbook = await Runbook.import(filePath.path);
    setCurrentRunbook(runbook.id);
    refreshRunbooks();

    track_event("runbooks.import", {
      total: await Runbook.count(),
    });
  };

  const handleOpenSearch = async () => {
    if (!isSearchOpen) setSearchOpen(true);
  };

  return (
    <div className="!w-64 !max-w-64 !min-w-64 h-full bg-gray-50 border-r border-gray-200 flex flex-col select-none">
      <div className="p-2 flex justify-between items-center border-b border-gray-200">
        <h2 className="text-lg font-semibold">Runbooks</h2>
        <div className="flex space-x-1">
          <Tooltip content="New">
            <Button
              isIconOnly
              size="sm"
              variant="light"
              onPress={handleNewRunbook}
            >
              <Plus size={18} />
            </Button>
          </Tooltip>

          <Tooltip content="Import">
            <Button
              isIconOnly
              size="sm"
              variant="light"
              onPress={handleImportRunbook}
            >
              <Import size={18} />
            </Button>
          </Tooltip>

          <Tooltip content="Search">
            <Button
              isIconOnly
              size="sm"
              variant="light"
              onPress={handleOpenSearch}
            >
              <SearchIcon size={18} />
            </Button>
          </Tooltip>
        </div>
      </div>
      <div className="flex-grow overflow-y-auto">
        {runbooks.map((runbook: Runbook) => {
          const count = Object.values(ptys).filter(
            (pty) => pty.runbook === runbook.id,
          ).length;
          const isActive = currentRunbook === runbook.id;

          return (
            <div
              key={runbook.id}
              onClick={async () => {
                track_event("runbooks.open", {
                  total: await Runbook.count(),
                });

                setCurrentRunbook(runbook.id);
              }}
              className={`cursor-pointer p-2 border-b border-gray-200 hover:bg-gray-100 ${isActive ? "bg-gray-200" : ""} relative`}
            >
              <div className="flex justify-between items-start">
                <div className={cn("flex-grow mr-2",  {"!max-w-[10.5rem]": count > 0})}>
                  <h3 className="font-medium text-sm truncate text-ellipsis">
                    {runbook.name || "Untitled"}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {DateTime.fromJSDate(runbook.updated).toLocaleString(
                      DateTime.DATETIME_SHORT,
                    )}
                  </p>
                </div>
                <div className="flex items-center">
                  {count > 0 && (
                    <Tooltip
                      content={`${count} active terminal${count > 1 ? "s" : ""}`}
                    >
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
                          onPress={() =>
                            Runbook.load(runbook.id).then((rb) => rb?.export())
                          }
                        >
                          Export
                        </DropdownItem>

                        <DropdownItem
                          key="move"
                          onMouseEnter={() => setMoveToOpen(true)}
                          onMouseLeave={() => setMoveToOpen(false)}
                          endContent={<ChevronRightIcon size={16} />}
                        >
                          <MoveRunbookDropdown runbook={runbook} isOpen={isMoveToOpen} onClose={() => setMoveToOpen(false)} />
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
                            if (runbook.id === currentRunbook)
                              setCurrentRunbook("");
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
