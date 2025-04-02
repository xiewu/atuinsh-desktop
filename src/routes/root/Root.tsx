import { open } from "@tauri-apps/plugin-shell";
import "./Root.css";

import { AtuinState, useStore } from "@/state/store";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import { Toaster } from "@/components/ui/toaster";

import icon from "@/assets/icon.svg";
import CommandMenu from "@/components/CommandMenu/CommandMenu";
import Sidebar, { SidebarItem } from "@/components/Sidebar";
import { checkForAppUpdates } from "@/updater";
import {
  addToast,
  Avatar,
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownSection,
  DropdownTrigger,
  Kbd,
  ScrollShadow,
  Spacer,
  Tooltip,
  User,
} from "@heroui/react";
import { UnlistenFn } from "@tauri-apps/api/event";
import { useEffect, useMemo, useRef, useState } from "react";
import { isAppleDevice } from "@react-aria/utils";
import { useTauriEvent } from "@/lib/tauri";
import { onOpenUrl } from "@tauri-apps/plugin-deep-link";

import handleDeepLink from "./deep";
import DesktopConnect from "@/components/DesktopConnect/DesktopConnect";
import * as api from "@/api/api";
import SocketManager from "@/socket";
import AtuinEnv from "@/atuin_env";
import List from "@/components/runbooks/List/List";
import Onboarding from "@/components/Onboarding/Onboarding";
import { KVStore } from "@/state/kv";
import Runbook from "@/state/runbooks/runbook";
import RunbookSearchIndex from "@/components/CommandMenu/RunbookSearchIndex";
import RunbookIndexService from "@/state/runbooks/search";
import UpdateNotifier from "./UpdateNotifier";
import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import DialogManager from "@/components/Dialogs/DialogManager";
import Workspace from "@/state/runbooks/workspace";
import track_event from "@/tracking";
import { invoke } from "@tauri-apps/api/core";
import RunbookContext from "@/context/runbook_context";
import { SET_RUNBOOK_TAG } from "@/state/store/runbook_state";
import DeleteRunbookModal from "./DeleteRunbookModal";
import Operation, { createRunbook, deleteRunbook } from "@/state/runbooks/operation";
import WorkspaceFolder, { Folder } from "@/state/runbooks/workspace_folders";
import { SharedStateManager } from "@/lib/shared_state/manager";
import { AtuinSharedStateAdapter } from "@/lib/shared_state/adapter";
import { DialogBuilder } from "@/components/Dialogs/dialog";
import { Rc } from "@binarymuse/ts-stdlib";

const runbookIndex = new RunbookIndexService();

async function isOnboardingComplete(): Promise<boolean> {
  let db = await KVStore.open_default();
  return (await db.get<boolean>("onboarding_complete")) || false;
}

function App() {
  const cleanupImportListener = useRef<UnlistenFn | null>(null);

  const refreshUser = useStore((state: AtuinState) => state.refreshUser);
  const importRunbooks = useStore((state: AtuinState) => state.importRunbooks);
  const refreshRunbooks = useStore((state: AtuinState) => state.refreshRunbooks);
  const currentWorkspaceId = useStore((state: AtuinState) => state.currentWorkspaceId);
  const setCurrentWorkspaceId = useStore((state: AtuinState) => state.setCurrentWorkspaceId);
  const setCurrentRunbookId = useStore((state: AtuinState) => state.setCurrentRunbookId);
  const colorMode = useStore((state: AtuinState) => state.functionalColorMode);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const serialExecution = useStore((state: AtuinState) => state.serialExecution);
  const currentRunbookId = useStore((state: AtuinState) => state.currentRunbookId);
  const setSerialExecution = useStore((state: AtuinState) => state.setSerialExecution);
  const [runbookIdToDelete, setRunbookIdToDelete] = useState<string | null>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const user = useStore((state: AtuinState) => state.user);
  const isLoggedIn = useStore((state: AtuinState) => state.isLoggedIn);
  const showDesktopConnect = useStore((state: AtuinState) => state.proposedDesktopConnectUser);

  let onOpenUrlListener = useRef<UnlistenFn | null>(null);

  function onSettingsOpen() {
    navigate("/settings");
  }

  useEffect(() => {
    (async () => {
      const onboardingComplete = await isOnboardingComplete();
      setShowOnboarding(!onboardingComplete);
    })();

    refreshRunbooks();
  }, []);

  useEffect(() => {
    (async () => {
      const unlisten = await onOpenUrl((urls) => {
        if (urls.length === 0) return;
        handleDeepLink(navigate, urls[0], handleRunbookActivate, handleRunbookCreated);
      });

      if (AtuinEnv.isDev) {
        (window as any).handleDeepLink = (url: string) =>
          handleDeepLink(navigate, url, handleRunbookActivate, handleRunbookCreated);
      }

      onOpenUrlListener.current = unlisten;
    })();

    return () => {
      if (onOpenUrlListener.current) {
        onOpenUrlListener.current();
      }
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const hotkey = isAppleDevice() ? "metaKey" : "ctrlKey";

      if (e?.key?.toLowerCase() === "," && e[hotkey]) {
        e.preventDefault();
        onSettingsOpen();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  async function doUpdateCheck() {
    // An available update will trigger a toast
    let updateAvailable = await checkForAppUpdates();

    if (!updateAvailable) {
      addToast({
        title: "No updates available",
        description: "You are running the latest version of Atuin Desktop",
        color: "primary",
        radius: "sm",
        timeout: 5000,
        shouldShowTimeoutProgress: true,
      });
    }
  }

  useTauriEvent("update-check", doUpdateCheck);
  useEffect(() => {
    window.addEventListener("update-check", doUpdateCheck);

    return () => {
      window.removeEventListener("update-check", doUpdateCheck);
    };
  }, []);

  useTauriEvent("import-runbook", async () => {
    handleImportRunbooks(currentWorkspaceId, null);
  });

  useTauriEvent("new-runbook", async () => {
    // Consider the case where we are already on the runbooks page
    if (location.pathname === "/runbooks") {
      let workspace = await Workspace.get(currentWorkspaceId);
      if (!workspace) {
        const workspaces = await Workspace.all();
        workspace = workspaces[0];
        setCurrentWorkspaceId(workspace.get("id")!);
      }
      let runbook = await Runbook.createUntitled(workspace);
      handleRunbookCreated(runbook.id, workspace.get("id")!, null);
      handleRunbookActivate(runbook.id);

      return;
    }
  });

  useTauriEvent("new-workspace", async () => {
    const workspace = new Workspace({
      name: "Untitled Workspace",
    });
    await workspace.save();
    setCurrentWorkspaceId(workspace.get("id")!);
    navigate(`/runbooks`);
  });

  useEffect(() => {
    const check = () => {
      (async () => {
        await checkForAppUpdates();
      })();

      setTimeout(check, 1000 * 60 * 60);
    };

    check();

    return () => {
      if (cleanupImportListener.current) cleanupImportListener.current();
    };
  }, []);

  async function handleImportRunbooks(workspaceId: string, parentFolderId: string | null) {
    const workspace = await Workspace.get(workspaceId);
    if (!workspace) return;

    let files = await importRunbooks();

    const runbookIds = await Promise.all(
      files.map(async (file) => {
        const rb = await Runbook.importFile(file, workspace);
        return rb.id;
      }),
    );

    const manager = SharedStateManager.getInstance<Folder>(
      `workspace-folder:${workspace.get("id")}`,
      new AtuinSharedStateAdapter(`workspace-folder:${workspace.get("id")}`),
    );

    const changeRef = await manager.updateOptimistic((data) => {
      const folder = WorkspaceFolder.fromJS(data);
      folder.importRunbooks(runbookIds, parentFolderId);
      return folder.toJS();
    });

    if (changeRef) {
      await Operation.create({
        type: "workspace_import_runbooks",
        workspaceId: workspace.get("id")!,
        parentFolderId,
        runbookIds,
        changeRef,
      });
    }

    handleRunbookActivate(runbookIds[0]);
  }

  const navigation: SidebarItem[] = useMemo(
    () => [
      {
        key: "personal",
        title: "Personal",
        items: [
          {
            key: "home",
            icon: "solar:home-2-linear",
            title: "Home",
            onPress: () => {
              navigate("/");
            },
          },

          {
            key: "runbooks",
            icon: "solar:notebook-linear",
            title: "Runbooks",
            onPress: () => {
              navigate("/runbooks");
            },
          },

          {
            key: "history",
            icon: "solar:history-outline",
            title: "History",
            onPress: () => {
              navigate("/history");
            },
          },

          {
            key: "stats",
            icon: "solar:chart-linear",
            title: "Stats",
            onPress: () => {
              navigate("/stats");
            },
          },
        ],
      },
    ],
    [colorMode],
  );

  async function logOut() {
    await api.clearHubApiToken();
    SocketManager.setApiToken(null);
    refreshUser();
  }

  function renderLogInOrOut() {
    if (isLoggedIn()) {
      return (
        <DropdownItem
          key="logout"
          description="Sign out of Atuin Hub"
          onPress={() => logOut()}
          color="danger"
        >
          Sign out
        </DropdownItem>
      );
    } else {
      return (
        <DropdownItem
          key="login"
          description="Sign in to Atuin Hub"
          onPress={() => open(`${api.endpoint()}/settings/desktop-connect`)}
        >
          Log in
        </DropdownItem>
      );
    }
  }

  const handleRunbookActivate = async (runbookId: string | null) => {
    if (serialExecution) {
      const answer = await new DialogBuilder<"cancel" | "stop_and_navigate">()
        .title("Stop Current Execution?")
        .message(
          "A runbook is currently being executed. Do you want to stop the execution and navigate to the selected runbook?",
        )
        .action({
          label: "Cancel",
          variant: "flat",
          value: "cancel",
        })
        .action({
          label: "Stop and Navigate",
          color: "danger",
          value: "stop_and_navigate",
        })
        .build();

      if (answer === "stop_and_navigate") {
        handleStopAndNavigate(runbookId);
      }

      return;
    }

    navigateToRunbook(runbookId);
  };

  const handleStopAndNavigate = async (newRunbookId: string | null) => {
    if (serialExecution !== newRunbookId) {
      await invoke("workflow_stop", { id: currentRunbookId });
      setSerialExecution(null);
    }

    navigateToRunbook(newRunbookId);
  };

  const navigateToRunbook = async (runbookId: string | null) => {
    let runbook: Runbook | null = null;
    if (runbookId) {
      runbook = await Runbook.load(runbookId);
    }

    track_event("runbooks.open", {
      total: await Runbook.count(),
    });

    if (location.pathname !== "/runbooks") {
      navigate("/runbooks");
    }
    setCurrentRunbookId(runbookId, SET_RUNBOOK_TAG);
    if (runbook) {
      setCurrentWorkspaceId(runbook.workspaceId);
    }
  };

  const handlePromptDeleteRunbook = async (runbookId: string) => {
    const runbook = await Runbook.load(runbookId);
    if (!runbook) {
      handleRunbookDeleted(currentWorkspaceId, runbookId);
      return;
    }

    setRunbookIdToDelete(runbookId);
  };

  async function handleRunbookDeleted(workspaceId: string, runbookId: string) {
    if (serialExecution === runbookId) {
      await invoke("workflow_stop", { id: runbookId });
    }

    const stateId = `workspace-folder:${workspaceId}`;
    const manager = SharedStateManager.getInstance<Folder>(
      stateId,
      new AtuinSharedStateAdapter(stateId),
    );

    const changeRef = await manager.updateOptimistic((state, cancel) => {
      const workspaceFolder = WorkspaceFolder.fromJS(state);
      const success = workspaceFolder.deleteRunbook(runbookId);
      if (!success) {
        cancel();
        return;
      }

      return workspaceFolder.toJS();
    });

    if (changeRef) {
      await Operation.create(deleteRunbook(workspaceId, runbookId, changeRef));
    }

    Rc.dispose(manager);
  }

  async function handleRunbookCreated(
    runbookId: string,
    workspaceId: string,
    parentFolderId: string | null,
  ) {
    const stateId = `workspace-folder:${workspaceId}`;
    const manager = SharedStateManager.getInstance<Folder>(
      stateId,
      new AtuinSharedStateAdapter(stateId),
    );

    const changeRef = await manager.updateOptimistic((state, cancel) => {
      const workspaceFolder = WorkspaceFolder.fromJS(state);
      const success = workspaceFolder.createRunbook(runbookId, parentFolderId);

      if (!success) {
        cancel();
        Rc.dispose(manager);
        return;
      }

      return workspaceFolder.toJS();
    });

    if (changeRef) {
      let workspace = await Workspace.get(workspaceId);
      if (!workspace) {
        const workspaces = await Workspace.all();
        workspace = workspaces[0];
      }
      await Operation.create(
        createRunbook(workspace.get("id")!, parentFolderId, runbookId, changeRef),
      );
    }

    Rc.dispose(manager);
  }

  const sidebarOpen = useStore((state) => state.sidebarOpen);
  const setSidebarOpen = useStore((state) => state.setSidebarOpen);

  return (
    <div
      className="flex w-screen dark:bg-default-50"
      style={{ maxWidth: "100vw", height: "calc(100dvh - 2rem)" }}
    >
      <RunbookContext.Provider
        value={{
          activateRunbook: handleRunbookActivate,
          promptDeleteRunbook: handlePromptDeleteRunbook,
          runbookDeleted: handleRunbookDeleted,
          runbookCreated: handleRunbookCreated,
          promptMoveRunbookWorkspace: () => {},
        }}
      >
        <CommandMenu index={runbookIndex} />
        <RunbookSearchIndex index={runbookIndex} />
        <UpdateNotifier />

        <div className="flex w-full">
          <div className="relative flex flex-col !border-r-small border-divider transition-width pb-6 pt-4 items-center select-none">
            <div className="flex items-center gap-0 px-3 justify-center">
              <div className="flex h-8 w-8">
                <img src={icon} alt="icon" className="h-8 w-8" />
              </div>
            </div>

            <ScrollShadow className="-mr-6 h-full max-h-full pr-6 mt-2">
              <Sidebar
                defaultSelectedKey="home"
                isCompact={true}
                items={navigation}
                className="z-50"
              />

              <Tooltip content={sidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}>
                <Button
                  isIconOnly
                  onPress={() => setSidebarOpen(!sidebarOpen)}
                  size="md"
                  variant="light"
                  className="ml-2"
                >
                  {sidebarOpen ? (
                    <PanelLeftCloseIcon size={20} className="stroke-gray-500" />
                  ) : (
                    <PanelLeftOpenIcon size={20} className="stroke-gray-500" />
                  )}
                </Button>
              </Tooltip>
            </ScrollShadow>

            <Spacer y={2} />

            <div className="flex items-center gap-3 px-3">
              <Dropdown showArrow placement="right-start">
                <DropdownTrigger>
                  <Button disableRipple isIconOnly radius="full" variant="light">
                    <Avatar
                      isBordered
                      className="flex-none"
                      size="sm"
                      name={user.username || ""}
                      src={user.avatar_url || ""}
                    />
                  </Button>
                </DropdownTrigger>
                <DropdownMenu aria-label="Custom item styles">
                  <DropdownItem
                    key="profile"
                    isReadOnly
                    className="h-14 opacity-100"
                    textValue="Signed in as"
                  >
                    {!isLoggedIn() && (
                      <User
                        avatarProps={{
                          size: "sm",
                          name: "Anonymous User",
                          showFallback: true,
                          imgProps: {
                            className: "transition-none",
                          },
                        }}
                        classNames={{
                          name: "text-default-600",
                          description: "text-default-500",
                        }}
                        name={"Anonymous User"}
                      />
                    )}
                    {isLoggedIn() && (
                      <User
                        avatarProps={{
                          src: user.avatar_url || "",
                          size: "sm",
                          name: user.username || "",
                          imgProps: {
                            className: "transition-none",
                          },
                        }}
                        classNames={{
                          name: "text-default-600",
                          description: "text-default-500",
                        }}
                        name={user.username || ""}
                        description={user.bio || ""}
                      />
                    )}
                  </DropdownItem>

                  <DropdownItem
                    key="settings"
                    description="Configure Atuin"
                    onPress={onSettingsOpen}
                    endContent={
                      <Kbd
                        className="px-1 py-0.5 text-xs font-semibold text-gray-600 bg-gray-100 border border-gray-200 rounded-md"
                        keys={["command"]}
                      >
                        ,
                      </Kbd>
                    }
                  >
                    Settings
                  </DropdownItem>

                  <DropdownSection aria-label="Help & Feedback" showDivider>
                    <DropdownItem
                      key="help_and_feedback"
                      description="Get in touch"
                      onPress={() => open("https://dub.sh/atuin-desktop-beta")}
                    >
                      Help & Feedback
                    </DropdownItem>
                  </DropdownSection>

                  {renderLogInOrOut()}
                </DropdownMenu>
              </Dropdown>
            </div>
          </div>

          <List importRunbooks={handleImportRunbooks} />
          <Outlet />

          <Toaster />

          {showDesktopConnect && <DesktopConnect />}
          {showOnboarding && <Onboarding />}
        </div>

        <DialogManager />
        {runbookIdToDelete && (
          <DeleteRunbookModal
            runbookId={runbookIdToDelete}
            onClose={() => setRunbookIdToDelete(null)}
            onRunbookDeleted={handleRunbookDeleted}
          />
        )}
      </RunbookContext.Provider>
    </div>
  );
}

export default App;
