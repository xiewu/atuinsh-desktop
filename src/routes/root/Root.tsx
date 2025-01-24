import { open } from "@tauri-apps/plugin-shell";
import "./Root.css";

import { AtuinState, useStore } from "@/state/store";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import { Toaster } from "@/components/ui/toaster";

import Settings from "@/components/Settings/Settings.tsx";

import icon from "@/assets/icon.svg";
import CommandMenu from "@/components/CommandMenu/CommandMenu";
import Sidebar, { SidebarItem } from "@/components/Sidebar";
import { checkForAppUpdates } from "@/updater";
import {
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
  useDisclosure,
  User,
} from "@heroui/react";
import { UnlistenFn } from "@tauri-apps/api/event";
import { message } from "@tauri-apps/plugin-dialog";
import { useEffect, useMemo, useRef, useState } from "react";
import { isAppleDevice } from "@react-aria/utils";
import CompactWorkspaceSwitcher from "@/components/WorkspaceSwitcher/WorkspaceSwitcher";
import { useTauriEvent } from "@/lib/tauri";
import { onOpenUrl } from "@tauri-apps/plugin-deep-link";

import handleDeepLink from "./deep";
import DesktopConnect from "@/components/DesktopConnect/DesktopConnect";
import DirectoryExportModal from "@/components/ExportWorkspace/ExportWorkspace";
import * as api from "@/api/api";
import SocketManager from "@/socket";
import AtuinEnv from "@/atuin_env";
import List from "@/components/runbooks/List/List";
import Workspace from "@/state/runbooks/workspace";
import Onboarding from "@/components/Onboarding/Onboarding";
import { KVStore } from "@/state/kv";
import Runbook from "@/state/runbooks/runbook";
import RunbookSearchIndex from "@/components/CommandMenu/RunbookSearchIndex";
import RunbookIndexService from "@/state/runbooks/search";
import DeleteRunbookModal from "./DeleteRunbookModal";

const runbookIndex = new RunbookIndexService();

async function isOnboardingComplete(): Promise<boolean> {
  let db = await KVStore.open_default();
  return (await db.get<boolean>("onboarding_complete")) || false;
}

function App() {
  const cleanupImportListener = useRef<UnlistenFn | null>(null);

  const refreshUser = useStore((state: AtuinState) => state.refreshUser);
  const importRunbook = useStore((state: AtuinState) => state.importRunbook);
  const refreshRunbooks = useStore((state: AtuinState) => state.refreshRunbooks);
  const currentWorkspaceId = useStore((state: AtuinState) => state.currentWorkspaceId);
  const setCurrentWorkspaceId = useStore((state: AtuinState) => state.setCurrentWorkspaceId);
  const setCurrentRunbookId = useStore((state: AtuinState) => state.setCurrentRunbookId);
  const colorMode = useStore((state: AtuinState) => state.colorMode);
  const setColorMode = useStore((state: AtuinState) => state.setColorMode);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [runbookIdToDelete, setRunbookIdToDelete] = useState<string | null>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const user = useStore((state: AtuinState) => state.user);
  const isLoggedIn = useStore((state: AtuinState) => state.isLoggedIn);
  const showDesktopConnect = useStore((state: AtuinState) => state.proposedDesktopConnectUser);

  let onOpenUrlListener = useRef<UnlistenFn | null>(null);

  function handleDeleteRunbook(runbookId: string) {
    setRunbookIdToDelete(runbookId);
  }

  useEffect(() => {
    (async () => {
      const onboardingComplete = await isOnboardingComplete();
      setShowOnboarding(!onboardingComplete);
    })();

    refreshRunbooks();
  }, []);

  const {
    isOpen: isSettingsOpen,
    onOpen: onSettingsOpen,
    onOpenChange: onSettingsOpenChange,
  } = useDisclosure();

  useEffect(() => {
    (async () => {
      const unlisten = await onOpenUrl((urls) => {
        if (urls.length === 0) return;
        handleDeepLink(navigate, urls[0]);
      });

      if (AtuinEnv.isDev) {
        (window as any).handleDeepLink = (url: string) => handleDeepLink(navigate, url);
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
        onSettingsOpenChange();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onSettingsOpenChange]);

  useTauriEvent("update-check", async () => {
    let updateAvailable = await checkForAppUpdates();

    if (!updateAvailable) {
      await message("No updates available", {
        title: "Atuin",
        kind: "info",
      });
    }
  });

  useTauriEvent("import-runbook", async () => {
    await importRunbook();
  });

  useTauriEvent("new-runbook", async () => {
    // Consider the case where we are already on the runbooks page
    if (location.pathname === "/runbooks") {
      let runbook = await Runbook.createUntitled(currentWorkspaceId);
      setCurrentRunbookId(runbook.id);

      return;
    }

    navigate(`/runbooks`, { state: { createNew: true } });
  });

  useTauriEvent("new-workspace", async () => {
    const workspace = await Workspace.create("Untitled Workspace");
    setCurrentWorkspaceId(workspace.id);
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
            key: "color-mode",
            icon: colorMode === "dark" ? "solar:sun-bold" : "solar:moon-bold",
            title: colorMode === "dark" ? "Light Mode" : "Dark Mode",
            onPress: () => {
              setColorMode(colorMode === "dark" ? "light" : "dark");
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

  return (
    <div
      className="flex w-screen dark:bg-default-50"
      style={{ maxWidth: "100vw", height: "calc(100dvh - 2rem)" }}
    >
      <CommandMenu index={runbookIndex} />
      <RunbookSearchIndex index={runbookIndex} />

      <div className="flex w-full">
        <div className="relative flex flex-col !border-r-small border-divider transition-width pb-6 pt-4 items-center select-none">
          <div className="flex items-center gap-0 px-3 justify-center">
            <div className="flex h-8 w-8">
              <img src={icon} alt="icon" className="h-8 w-8" />
            </div>
          </div>

          <div className="mt-6">
            <CompactWorkspaceSwitcher />
          </div>

          <ScrollShadow className="-mr-6 h-full max-h-full pr-6">
            <Sidebar
              defaultSelectedKey="home"
              isCompact={true}
              items={navigation}
              className="z-50"
            />
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

        <List onDeleteRunbook={handleDeleteRunbook} />
        <Outlet />

        <Toaster />
        <Settings onOpenChange={onSettingsOpenChange} isOpen={isSettingsOpen} />

        {showDesktopConnect && <DesktopConnect />}
        {showOnboarding && <Onboarding />}

        <Settings onOpenChange={onSettingsOpenChange} isOpen={isSettingsOpen} />
        <DirectoryExportModal />
        {runbookIdToDelete && (
          <DeleteRunbookModal
            runbookId={runbookIdToDelete}
            onClose={() => setRunbookIdToDelete(null)}
          />
        )}
      </div>
    </div>
  );
}

export default App;
