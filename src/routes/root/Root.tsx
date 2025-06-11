import { open } from "@tauri-apps/plugin-shell";
import "./Root.css";

import { AtuinState, useStore } from "@/state/store";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import { Toaster } from "@/components/ui/toaster";

import icon from "@/assets/icon.svg";
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
import React, { useEffect, useMemo, useRef, useState } from "react";
import { isAppleDevice } from "@react-aria/utils";
import { useTauriEvent } from "@/lib/tauri";
import { onOpenUrl } from "@tauri-apps/plugin-deep-link";

import handleDeepLink from "./deep";
import * as api from "@/api/api";
import SocketManager from "@/socket";
import type { ListApi } from "@/components/runbooks/List/List";
import { KVStore } from "@/state/kv";
import Runbook from "@/state/runbooks/runbook";
import RunbookIndexService from "@/state/runbooks/search";
import { MailPlusIcon, PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import Workspace from "@/state/runbooks/workspace";
import track_event from "@/tracking";
import { invoke } from "@tauri-apps/api/core";
import RunbookContext from "@/context/runbook_context";
import { SET_RUNBOOK_TAG } from "@/state/store/runbook_state";
import Operation, {
  createRunbook,
  createWorkspace,
  deleteRunbook,
} from "@/state/runbooks/operation";
import { DialogBuilder } from "@/components/Dialogs/dialog";
import WorkspaceSyncManager from "@/lib/sync/workspace_sync_manager";
import doWorkspaceFolderOp from "@/state/runbooks/workspace_folder_ops";
import { AtuinSharedStateAdapter } from "@/lib/shared_state/adapter";
import { SharedStateManager } from "@/lib/shared_state/manager";
import WorkspaceFolder, { Folder } from "@/state/runbooks/workspace_folders";
import { Rc } from "@binarymuse/ts-stdlib";
import { TraversalOrder } from "@/lib/tree";
import DevConsole from "@/lib/dev/dev_console";
import Sidebar, { SidebarItem } from "@/components/Sidebar";
import { getGlobalOptions } from "@/lib/global_options";
import InviteFriendsModal from "./InviteFriendsModal";

const Onboarding = React.lazy(() => import("@/components/Onboarding/Onboarding"));
const UpdateNotifier = React.lazy(() => import("./UpdateNotifier"));
const CommandMenu = React.lazy(() => import("@/components/CommandMenu/CommandMenu"));
const DialogManager = React.lazy(() => import("@/components/Dialogs/DialogManager"));
const DesktopConnect = React.lazy(() => import("@/components/DesktopConnect/DesktopConnect"));
const DeleteRunbookModal = React.lazy(() => import("./DeleteRunbookModal"));
const RunbookSearchIndex = React.lazy(() => import("@/components/CommandMenu/RunbookSearchIndex"));
const List = React.lazy(() => import("@/components/runbooks/List/List"));

type MoveBundleDescendant =
  | {
      type: "runbook";
      id: string;
      parentId: string;
    }
  | {
      type: "folder";
      id: string;
      name: string;
      parentId: string;
    };

type MoveBundle =
  | {
      type: "runbook";
      id: string;
    }
  | {
      type: "folder";
      id: string;
      name: string;
      descendants: Array<MoveBundleDescendant>;
    };

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
  const [showInviteFriends, setShowInviteFriends] = useState(false);
  const serialExecution = useStore((state: AtuinState) => state.serialExecution);
  const currentRunbookId = useStore((state: AtuinState) => state.currentRunbookId);
  const setSerialExecution = useStore((state: AtuinState) => state.setSerialExecution);
  const [runbookIdToDelete, setRunbookIdToDelete] = useState<string | null>(null);
  const selectedOrg = useStore((state: AtuinState) => state.selectedOrg);

  const navigate = useNavigate();
  const location = useLocation();
  const user = useStore((state: AtuinState) => state.user);
  const isLoggedIn = useStore((state: AtuinState) => state.isLoggedIn);
  const showDesktopConnect = useStore((state: AtuinState) => state.proposedDesktopConnectUser);

  const listRef = useRef<ListApi>(null);

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
        handleDeepLink(urls[0], handleRunbookCreated);
      });

      DevConsole.addAppObject("handleDeepLink", (url: string) =>
        handleDeepLink(url, handleRunbookCreated),
      );

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
    if (getGlobalOptions().os !== "macos") {
      new DialogBuilder()
        .icon("warning")
        .title("Automatic Updates Not Supported")
        .message("Automatic updates are not supported on this platform.")
        .action({ label: "OK", value: "ok", variant: "flat" })
        .build();
      return;
    }

    // An available update will trigger a toast
    let updateAvailable = await checkForAppUpdates(true);

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

  async function createNewWorkspace() {
    const workspace = new Workspace({
      name: "Untitled Workspace",
    });

    if (selectedOrg) {
      workspace.set("orgId", selectedOrg);
    }

    await workspace.save();

    console.log("workspace saved", workspace);
    track_event("workspace.create");

    setCurrentWorkspaceId(workspace.get("id")!);
    navigate(`/runbooks`);

    const op = new Operation({
      operation: createWorkspace(
        workspace.get("id")!,
        workspace.get("name")!,
        selectedOrg ? { type: "org", orgId: selectedOrg } : { type: "user" },
      ),
    });
    await op.save();

    listRef.current?.scrollWorkspaceIntoView(workspace.get("id")!);
  }

  useTauriEvent("update-check", doUpdateCheck);
  useEffect(() => {
    window.addEventListener("update-check", doUpdateCheck);

    return () => {
      window.removeEventListener("update-check", doUpdateCheck);
    };
  }, []);

  useTauriEvent("start-sync", async () => {
    await WorkspaceSyncManager.get(useStore).startSync();
  });

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
    createNewWorkspace();
  });

  useEffect(() => {
    const check = () => {
      if (getGlobalOptions().os !== "macos") {
        return;
      }

      (async () => {
        await checkForAppUpdates(false);
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

    doWorkspaceFolderOp(
      workspaceId,
      (wsf) => {
        return wsf.importRunbooks(runbookIds, parentFolderId);
      },
      (changeRef) => {
        return {
          type: "workspace_import_runbooks",
          workspaceId: workspace.get("id")!,
          parentFolderId,
          runbookIds,
          changeRef,
        };
      },
    );

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
    // Set runbook ID synchronously so that the observer doesn't try to sync
    setCurrentRunbookId(runbookId, SET_RUNBOOK_TAG);

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
    if (runbook) {
      setCurrentWorkspaceId(runbook.workspaceId);
      listRef.current?.scrollWorkspaceIntoView(runbook.workspaceId);
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

    doWorkspaceFolderOp(
      workspaceId,
      (wsf) => {
        return wsf.deleteRunbook(runbookId);
      },
      (changeRef) => {
        return deleteRunbook(workspaceId, runbookId, changeRef);
      },
    );
  }

  async function handleRunbookCreated(
    runbookId: string,
    workspaceId: string,
    parentFolderId: string | null,
    activate: boolean = false,
  ) {
    // NOTE [mkt]:
    // This API call is made here instead of through the operation processor
    // because we need to wait for the runbook to be created on the server
    // before opening it; this is so the server observer doesn't create an
    // observer for the runbook and cause a YJS sync conflict.
    //
    // Note that this requires `currentRunbookId` to be set synchronously,
    // so that we create a PhoenixProvider via RunbookEditor,
    // which is why we call `handleRunbookActivate` before updating
    // the workspace folder (which would trigger the server observer).
    const workspace = await Workspace.get(workspaceId);
    // TODO: remove check for org once all runbooks are online by default
    if (workspace && workspace.isOrgOwned()) {
      const runbook = await Runbook.load(runbookId);
      if (!runbook) {
        new DialogBuilder()
          .title("Could not load runbook")
          .message("We were unable to load the runbook.")
          .action({ label: "OK", value: "ok", variant: "flat" })
          .build();
        return;
      }
      try {
        let startedSyncIndicator = false;
        // TODO: use sync increment/decrement???
        if (!useStore.getState().isSyncing) {
          startedSyncIndicator = true;
          useStore.getState().setIsSyncing(true);
        }

        if (startedSyncIndicator) {
          useStore.getState().setIsSyncing(false);
        }

        await api.createRunbook(runbook, runbook.id, "private");
      } catch (err) {
        if (err instanceof api.HttpResponseError) {
          new DialogBuilder()
            .title("Failed to create Org runbook")
            .message("The API request to create the runbook for the Org failed.")
            .action({ label: "OK", value: "ok", variant: "flat" })
            .build();
        } else {
          new DialogBuilder()
            .title("Failed to create Org runbook")
            .message("You may be offline, or the server may be down.")
            .action({ label: "OK", value: "ok", variant: "flat" })
            .build();
        }
        console.error(err);
        runbook.delete();
        return;
      }
    }

    if (activate) {
      handleRunbookActivate(runbookId);
    }

    track_event("runbooks.create");

    doWorkspaceFolderOp(
      workspaceId,
      (wsf) => {
        wsf.createRunbook(runbookId, parentFolderId);
        return true;
      },
      (changeRef) => {
        return createRunbook(workspaceId, parentFolderId, runbookId, changeRef);
      },
    );
  }

  async function handleMoveItemsToWorkspace(
    items: string[],
    oldWorkspaceId: string,
    newWorkspaceId: string,
    newParentFolderId: string | null,
  ) {
    if (oldWorkspaceId === newWorkspaceId) {
      return;
    }

    const oldWorkspace = await Workspace.get(oldWorkspaceId);
    const newWorkspace = await Workspace.get(newWorkspaceId);

    if (!oldWorkspace || !newWorkspace) {
      return;
    }

    if (!oldWorkspace.canManageRunbooks() || !newWorkspace.canManageRunbooks()) {
      await new DialogBuilder()
        .title("Cannot Move Items")
        .icon("error")
        .message(
          "You must have permissions to manage runbooks in both the source and destination workspaces " +
            "in order to move items.",
        )
        .action({
          label: "OK",
          variant: "flat",
          value: "ok",
        })
        .build();

      return;
    }

    const oldStateId = `workspace-folder:${oldWorkspace.get("id")}`;
    const newStateId = `workspace-folder:${newWorkspace.get("id")}`;
    const oldManager = SharedStateManager.getInstance<Folder>(
      oldStateId,
      new AtuinSharedStateAdapter(oldStateId),
    );
    const newManager = SharedStateManager.getInstance<Folder>(
      newStateId,
      new AtuinSharedStateAdapter(newStateId),
    );

    const oldFolder = WorkspaceFolder.fromJS(await oldManager.getDataOnce());

    // Step 1: Calculate the items that need to be moved
    let moveInfo = {
      folders: 0,
      runbooks: 0,
    };
    // Each bundle represents a top-level runbook or folder
    // that is being moved, along with all of its descendants
    const moveBundles: Array<MoveBundle> = [];
    for (const item of items) {
      const node = oldFolder.getNode(item);
      if (node.isNone()) {
        continue;
      }
      const data = node.unwrap().getData().unwrap();

      if (data.type === "runbook") {
        moveBundles.push({ type: "runbook", id: item });
        moveInfo.runbooks++;
      } else {
        const descendants = oldFolder
          .getDescendants(item, TraversalOrder.DepthFirst)
          .map((node) => {
            const data = node.getData().unwrap();
            const parentId = node
              .parent()
              .map((n) => n.id() as string) // safe because parent is definitely not root
              .unwrap();
            if (data.type === "folder") {
              return { id: data.id, type: data.type, name: data.name, parentId };
            } else {
              return { id: data.id, type: data.type, parentId };
            }
          });

        for (const descendant of descendants) {
          if (descendant.type === "runbook") {
            moveInfo.runbooks++;
          } else {
            moveInfo.folders++;
          }
        }

        moveBundles.push({ type: "folder", id: item, name: data.name, descendants });
      }
    }
    // Step 2: Confirm the move
    const answer = await confirmMoveItems(moveBundles, moveInfo, newWorkspace);
    if (answer === "no") {
      return;
    }

    // Step 3: Add the items to the new workspace first
    let failure: string | null = null;
    const createChangeRef = await newManager.updateOptimistic((data, cancel) => {
      // Refresh workspace folder since we awaited the confirmation
      const wsf = WorkspaceFolder.fromJS(data);

      // Make sure the folder we're moving to exists, if it's not root
      if (newParentFolderId && wsf.getNode(newParentFolderId).isNone()) {
        failure = "Target parent folder not found";
        return cancel();
      }

      for (const item of moveBundles) {
        if (item.type === "folder") {
          const success = wsf.createFolder(item.id, item.name, newParentFolderId);
          if (!success) {
            failure = "Failed to create folder";
            return cancel();
          }

          for (const descendant of item.descendants) {
            // Descendants are in DFS order
            if (descendant.type === "folder") {
              const success = wsf.createFolder(descendant.id, descendant.name, descendant.parentId);
              if (!success) {
                failure = "Failed to create folder";
                return cancel();
              }
            } else {
              const parentNode = wsf.getNode(descendant.parentId);
              if (parentNode.isNone()) {
                failure = "Failed to create runbook";
                return cancel();
              }
              wsf.createRunbook(descendant.id, descendant.parentId);
            }
          }
        } else {
          wsf.createRunbook(item.id, newParentFolderId);
        }
      }

      return wsf.toJS();
    });

    if (!createChangeRef || failure) {
      if (createChangeRef) {
        oldManager.expireOptimisticUpdates([createChangeRef]);
      }

      await new DialogBuilder()
        .title("Failed to move items")
        .icon("error")
        .message(failure || "An unknown error occurred")
        .action({ label: "OK", value: "ok", variant: "flat" })
        .build();

      return;
    }

    // Step 4: Remove the items from the old workspace, using delete cascade
    const deleteChangeRef = await oldManager.updateOptimistic((data) => {
      const wsf = WorkspaceFolder.fromJS(data);

      // Deleting fails if the item isn't found in the tree, so we can ignore errors
      for (const item of moveBundles) {
        if (item.type === "folder") {
          wsf.deleteFolder(item.id);
        } else {
          wsf.deleteRunbook(item.id);
        }
      }

      return wsf.toJS();
    });

    // This should never fail, but those are famous last words
    if (!deleteChangeRef) {
      if (createChangeRef) {
        oldManager.expireOptimisticUpdates([createChangeRef]);
      }

      await new DialogBuilder()
        .title("Failed to move items")
        .icon("error")
        .message("Failed to remove items from old workspace")
        .build();

      return;
    }

    // Step 5: Update the runbook models to point to the new workspace
    for (const item of moveBundles) {
      if (item.type === "runbook") {
        const runbook = await Runbook.load(item.id);
        if (runbook) {
          runbook.workspaceId = newWorkspaceId;
          await runbook.save();
        }
      } else if (item.type === "folder") {
        for (const descendant of item.descendants) {
          if (descendant.type === "runbook") {
            const runbook = await Runbook.load(descendant.id);
            if (runbook) {
              runbook.workspaceId = newWorkspaceId;
              await runbook.save();
            }
          }
        }
      }
    }

    // Step 6: Create an operation that contains both changeRefs to send to the server;
    // the server will then process the changeRefs and update the runbook models as well
    // TODO

    Rc.dispose(oldManager);
    Rc.dispose(newManager);
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
          runbookMoved: () => {},
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

            <div className="flex flex-col items-center gap-4 px-3">
              {isLoggedIn() && (
                <Tooltip content="Invite friends and colleagues to try Atuin Desktop">
                  <Button
                    isIconOnly
                    variant="light"
                    size="lg"
                    onPress={() => setShowInviteFriends(true)}
                  >
                    <MailPlusIcon className="w-6 h-6" size={24} />
                  </Button>
                </Tooltip>
              )}

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

          <List
            importRunbooks={handleImportRunbooks}
            onStartCreateWorkspace={createNewWorkspace}
            moveItemsToWorkspace={handleMoveItemsToWorkspace}
            ref={listRef}
          />
          <Outlet />

          <Toaster />

          {showDesktopConnect && <DesktopConnect />}
          {showOnboarding && <Onboarding />}
          <InviteFriendsModal
            isOpen={showInviteFriends}
            onClose={() => setShowInviteFriends(false)}
          />
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

async function confirmMoveItems(
  moveBundles: Array<MoveBundle>,
  info: {
    folders: number;
    runbooks: number;
  },
  targetWorkspace: Workspace,
): Promise<"yes" | "no"> {
  const total = info.folders + info.runbooks;
  let countSnippet: React.ReactNode | null = null;

  if (info.folders === 0 && info.runbooks > 0) {
    countSnippet = (
      <strong className="text-danger">
        {info.runbooks} {info.runbooks === 1 ? "runbook" : "runbooks"}
      </strong>
    );
  } else if (info.folders > 0 && info.runbooks === 0) {
    countSnippet = (
      <strong className="text-danger">
        {info.folders} {info.folders === 1 ? "subfolder" : "subfolders"}
      </strong>
    );
  } else if (info.folders > 0 && info.runbooks > 0) {
    countSnippet = (
      <>
        <strong className="text-danger">
          {info.folders} {info.folders === 1 ? "subfolder" : "subfolders"}
        </strong>{" "}
        and{" "}
        <strong className="text-danger">
          {info.runbooks} {info.runbooks === 1 ? "runbook" : "runbooks"}
        </strong>
      </>
    );
  }

  const message = (
    <div>
      <p>
        Are you sure you want to move {moveBundles.length}{" "}
        {moveBundles.length === 1 ? "item" : "items"}
        to the {targetWorkspace.get("name")} workspace?
      </p>

      {total > 0 && <p>This will move {countSnippet}.</p>}
    </div>
  );

  return new DialogBuilder<"yes" | "no">()
    .title(`Confirm Move Items`)
    .icon("warning")
    .message(message)
    .action({ label: "Cancel", value: "no", variant: "flat" })
    .action({
      label: `Move ${total} ${total === 1 ? "Item" : "Items"}`,
      value: "yes",
      color: "danger",
      confirmWith:
        total > 0 ? `Confirm Moving ${total} ${total === 1 ? "Item" : "Items"}` : undefined,
    })
    .build();
}
