import {
  Button,
  Tooltip,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Progress,
  ButtonGroup,
  CircularProgress,
  Avatar,
  DropdownSection,
} from "@heroui/react";
import { ArrowUpDownIcon, ChevronDownIcon, FileSearchIcon, Plus } from "lucide-react";
import Runbook from "@/state/runbooks/runbook";
import { AtuinState, useStore } from "@/state/store";
import {
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { PendingInvitations } from "./PendingInvitations";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Menu } from "@tauri-apps/api/menu";
import { SortBy } from "./TreeView";
import { orgWorkspaces, userOwnedWorkspaces } from "@/lib/queries/workspaces";
import { default as WorkspaceComponent } from "./Workspace";
import WorkspaceFolder, { Folder } from "@/state/runbooks/workspace_folders";
import doWorkspaceSetup from "@/lib/workspace_setup";
import RunbookContext from "@/context/runbook_context";
import { createNewRunbookMenu, createRootMenu } from "./menus";
import { SharedStateManager } from "@/lib/shared_state/manager";
import { AtuinSharedStateAdapter } from "@/lib/shared_state/adapter";
import VerticalDragHandle from "./VerticalDragHandle";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

export type ListApi = {
  scrollWorkspaceIntoView: (workspaceId: string) => void;
};

interface NotesSidebarProps {
  importRunbooks: (workspaceId: string, parentFolderId: string | null) => Promise<void>;
  onStartCreateWorkspace: () => void;
  moveItemsToWorkspace: (
    items: string[],
    oldWorkspaceId: string,
    newWorkspaceId: string,
    newParentFolderId: string | null,
  ) => void;
}

const NoteSidebar = forwardRef((props: NotesSidebarProps, ref: React.ForwardedRef<ListApi>) => {
  const isSyncing = useStore((state: AtuinState) => state.isSyncing);
  const [isSearchOpen, setSearchOpen] = useStore((store: AtuinState) => [
    store.searchOpen,
    store.setSearchOpen,
  ]);
  const [sortBy, setSortBy] = useState<SortBy>(SortBy.Name);
  const [pendingWorkspaceMigration, setPendingWorkspaceMigration] = useState<boolean>(true);
  const [focusedWorkspaceId, setFocusedWorkspaceId] = useState<string | null>(null);

  const currentRunbookId = useStore((state: AtuinState) => state.currentRunbookId);
  const currentWorkspaceId = useStore((state: AtuinState) => state.currentWorkspaceId);

  const sidebarWidth = useStore((state: AtuinState) => state.sidebarWidth);
  const setSidebarWidth = useStore((state: AtuinState) => state.setSidebarWidth);
  const sidebarOpen = useStore((state: AtuinState) => state.sidebarOpen);
  const elRef = useRef<HTMLDivElement>(null);
  const user = useStore((state: AtuinState) => state.user);
  const userOrgs = useStore((state: AtuinState) => state.userOrgs);
  const selectedOrg = useStore((state: AtuinState) => state.selectedOrg);
  const setSelectedOrg = useStore((state: AtuinState) => state.setSelectedOrg);

  const { data: workspaces } = useQuery(
    selectedOrg ? orgWorkspaces(selectedOrg) : userOwnedWorkspaces(),
  );

  const onResize = useCallback(
    (delta: number) => {
      setSidebarWidth(sidebarWidth + delta);
    },
    [sidebarWidth],
  );

  const { activateRunbook, promptDeleteRunbook, runbookCreated } = useContext(RunbookContext);

  const queryClient = useQueryClient();

  useImperativeHandle(ref, () => {
    return {
      scrollWorkspaceIntoView: async (workspaceId: string) => {
        const getElPromise = new Promise<HTMLElement | null>((resolve, reject) => {
          let start = performance.now();
          let el: HTMLElement | null = null;
          const tryGetEl = () => {
            el = document.getElementById(`workspace-el-${workspaceId}`);
            if (el) {
              resolve(el);
            } else if (performance.now() - start < 1000) {
              setTimeout(tryGetEl, 100);
            } else {
              reject(new Error("Element not found"));
            }
          };
          tryGetEl();
        });

        const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        try {
          const el = await getElPromise;
          if (el) {
            // Check if element is completely outside the container
            const rect = el.getBoundingClientRect();
            const containerRect = elRef.current?.getBoundingClientRect();

            if (containerRect) {
              const isCompletelyOutsideViewport =
                rect.bottom <= containerRect.top || // element is entirely above container
                rect.top >= containerRect.bottom || // element is entirely below container
                rect.right <= containerRect.left || // element is entirely to the left of container
                rect.left >= containerRect.right; // element is entirely to the right of container

              // Only scroll if the element is completely outside the container
              if (isCompletelyOutsideViewport) {
                el.scrollIntoView({ behavior: prefersReducedMotion ? "instant" : "smooth" });
              }
            }
          }
        } catch (_e) {
          //
        }
      },
    };
  });

  useEffect(() => {
    doWorkspaceSetup().then(() => {
      queryClient.invalidateQueries(userOwnedWorkspaces());
      setPendingWorkspaceMigration(false);
    });
  }, []);

  const handleMoveItemsToWorkspace = async (
    items: string[],
    workspaceId: string,
    newWorkspaceId: string,
    newParentFolderId: string | null,
  ) => {
    props.moveItemsToWorkspace(items, workspaceId, newWorkspaceId, newParentFolderId);
  };

  const handleNewRunbook = async (workspaceId: string, parentFolderId: string | null) => {
    const workspace = workspaces?.find((ws) => ws.get("id") === workspaceId);
    if (!workspace) return;

    const rb = await Runbook.createUntitled(workspace, true);

    runbookCreated(rb.id, workspaceId, parentFolderId, true);
  };

  const handleImportRunbook = async (workspaceId: string | null, parentFolderId: string | null) => {
    const wsId = workspaceId ?? currentWorkspaceId;
    props.importRunbooks(wsId, parentFolderId);
  };

  const handleOpenSearch = async () => {
    if (!isSearchOpen) setSearchOpen(true);
  };

  async function handleOpenSortMenu() {
    const sortMenu = await Menu.new({
      id: "sort_menu",
      items: [
        {
          id: "sort_by_name_desc",
          text: "Name",
          action: () => {
            setSortBy(SortBy.Name);
          },
          accelerator: "N",
          checked: sortBy === SortBy.Name,
        },
        {
          id: "sort_by_name_asc",
          text: "Name (ascending)",
          action: () => {
            setSortBy(SortBy.NameAsc);
          },
          accelerator: "Shift+N",
          checked: sortBy === SortBy.NameAsc,
        },
        {
          id: "sort_by_updated",
          text: "Updated",
          action: () => {
            setSortBy(SortBy.Updated);
          },
          accelerator: "U",
          checked: sortBy === SortBy.Updated,
        },
        {
          id: "sort_by_updated_asc",
          text: "Updated (ascending)",
          action: () => {
            setSortBy(SortBy.UpdatedAsc);
          },
          accelerator: "Shift+U",
          checked: sortBy === SortBy.UpdatedAsc,
        },
      ],
    });
    await sortMenu.popup();
    sortMenu.close();
  }

  async function handleNewRunbookMenu() {
    if (!workspaces) return;

    const workspaceFolders = await Promise.all(
      workspaces.map(async (ws) => {
        const stateId = `workspace-folder:${ws.get("id")}`;
        const manager = SharedStateManager.getInstance<Folder>(
          stateId,
          new AtuinSharedStateAdapter(stateId),
        );
        const data = await manager.getDataOnce();
        const folder = WorkspaceFolder.fromJS(data);
        return folder.toArborist();
      }),
    );

    const menu = await createNewRunbookMenu(
      workspaces.map((ws, idx) => ({
        workspace: ws,
        folder: workspaceFolders[idx],
      })),
      {
        onNewRunbook: (workspaceId: string, parentFolderId: string | null) => {
          handleNewRunbook(workspaceId, parentFolderId);
        },
        onImportRunbook: (workspaceId: string | null, parentFolderId: string | null) => {
          handleImportRunbook(workspaceId, parentFolderId);
        },
        onNewWorkspace: () => {
          props.onStartCreateWorkspace();
        },
      },
    );

    await menu.popup();
    menu.close();
  }

  async function handleBaseContextMenu(evt: React.MouseEvent<HTMLDivElement>) {
    evt.preventDefault();
    evt.stopPropagation();

    const menu = await createRootMenu({
      onNewWorkspace: () => {
        props.onStartCreateWorkspace();
      },
    });

    await menu.popup();
    menu.close();
  }

  return (
    <div
      className={cn([
        "hidden relative h-full bg-gray-50 dark:bg-content1 border-r border-gray-200 dark:border-default-300 select-none",
        {
          "md:flex md:flex-col": sidebarOpen,
        },
      ])}
      style={{
        width: `${sidebarWidth}px`,
        maxWidth: `${sidebarWidth}px`,
        minWidth: `${sidebarWidth}px`,
      }}
      ref={elRef}
    >
      {pendingWorkspaceMigration && (
        <>
          <div className="p-2 h-[60px] min-height-[60px] flex justify-between items-center border-b border-gray-200 dark:border-gray-600">
            <h2 className="text-lg font-semibold"></h2>
            <div className="flex space-x-1"></div>
          </div>
          <div className="p-2 mt-10 text-center">Setting up...</div>
          <div className="flex justify-center items-center mt-6">
            <CircularProgress />
          </div>
        </>
      )}
      {!pendingWorkspaceMigration && (
        <>
          <Progress
            isIndeterminate={isSyncing}
            size="sm"
            radius="none"
            disableAnimation
            classNames={{ track: "bg-transparent" }}
          />
          <PendingInvitations />
          <div className="border-b border-gray-200 dark:border-gray-600">
            <Dropdown showArrow size="lg" placement="bottom-end">
              <DropdownTrigger>
                <div
                  className={cn(
                    "flex flex-row justify-between items-center p-2 pl-4",
                    "hover:bg-gray-100 dark:hover:bg-content2",
                    "cursor-pointer",
                    "border-b border-gray-200 dark:border-gray-700",
                    "h-[56px] max-h-[56px] min-h-[56px]",
                  )}
                >
                  {selectedOrg && (
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      {userOrgs.find((org) => org.id === selectedOrg)?.name}
                    </h2>
                  )}
                  {!selectedOrg && (
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      {user.isLoggedIn() ? (
                        <>
                          {user.avatar_url && (
                            <Avatar
                              src={user.avatar_url}
                              size="sm"
                              radius="sm"
                              classNames={{ base: "inline-block mr-2 mt min-w-[32px]" }}
                              name={user.username}
                            />
                          )}
                          {user.username}
                        </>
                      ) : (
                        "Personal"
                      )}
                    </h2>
                  )}
                  <ChevronDownIcon size={16} />
                </div>
              </DropdownTrigger>
              <DropdownMenu selectedKeys={selectedOrg || "personal"}>
                <DropdownSection title="Choose an Organization">
                  <DropdownItem
                    key="personal"
                    startContent={
                      user.avatar_url && (
                        <Avatar
                          src={user.avatar_url}
                          size="sm"
                          radius="sm"
                          classNames={{ base: "inline-block mr-2 mt min-w-[32px]" }}
                          name={user.username}
                        />
                      )
                    }
                    onPress={() => setSelectedOrg(null)}
                  >
                    {user.isLoggedIn() ? <h3>{user.username} (Personal)</h3> : <h3>Personal</h3>}
                  </DropdownItem>
                  <>
                    {userOrgs.map((org) => (
                      <DropdownItem key={org.id} onPress={() => setSelectedOrg(org.id)}>
                        {org.name}
                      </DropdownItem>
                    ))}
                  </>
                </DropdownSection>
              </DropdownMenu>
            </Dropdown>

            <div className="flex justify-between items-center p-2">
              <ButtonGroup>
                <Button
                  size="sm"
                  variant="flat"
                  onPress={() => handleNewRunbook(workspaces?.[0]?.get("id")!, null)}
                >
                  <Plus size={18} /> New Runbook
                </Button>
                <Button
                  size="sm"
                  variant="flat"
                  isIconOnly
                  className="border-l-2 border-gray-200 dark:border-gray-700"
                  onPress={() => handleNewRunbookMenu()}
                >
                  <ChevronDownIcon size={18} />
                </Button>
              </ButtonGroup>

              <div>
                {false && (
                  <Tooltip content="Sort by...">
                    <Button isIconOnly size="sm" variant="light" onPress={handleOpenSortMenu}>
                      <ArrowUpDownIcon size={18} />
                    </Button>
                  </Tooltip>
                )}

                <Tooltip content="Search" placement="bottom">
                  <Button isIconOnly size="sm" variant="light" onPress={handleOpenSearch}>
                    <FileSearchIcon size={18} />
                  </Button>
                </Tooltip>
              </div>
            </div>
          </div>
          <div
            className="p-1 flex-grow overflow-y-scroll cursor-default"
             onContextMenu={handleBaseContextMenu}
          >
            <DndProvider backend={HTML5Backend}>
              {workspaces && (
                <div className="flex flex-col gap-2">
                  {workspaces.map((workspace) => {
                  return (
                    <div
                      className="w-[98%] m-auto"
                      onClick={() => setFocusedWorkspaceId(workspace.get("id")!)}
                      key={workspace.get("id")!}
                      id={`workspace-el-${workspace.get("id")!}`}
                    >
                      <WorkspaceComponent
                        workspace={workspace}
                        focused={focusedWorkspaceId === workspace.get("id")}
                        sortBy={sortBy}
                        currentRunbookId={currentRunbookId}
                        onActivateRunbook={activateRunbook}
                        onStartCreateRunbook={(
                          workspaceId: string,
                          parentFolderId: string | null,
                        ) => handleNewRunbook(workspaceId, parentFolderId)}
                        onStartCreateWorkspace={props.onStartCreateWorkspace}
                        onStartDeleteRunbook={(_workspaceId: string, runbookId: string) =>
                          promptDeleteRunbook(runbookId)
                        }
                        onStartMoveItemsToWorkspace={handleMoveItemsToWorkspace}
                      />
                    </div>
                  );
                })}
              </div>
            )}
            </DndProvider>
          </div>
        </>
      )}
      <VerticalDragHandle minSize={200} onResize={onResize} />
    </div>
  );
});

export default NoteSidebar;
