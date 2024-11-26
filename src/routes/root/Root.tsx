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
} from "@nextui-org/react";
import { UnlistenFn } from "@tauri-apps/api/event";
import { message } from "@tauri-apps/plugin-dialog";
import { useEffect, useRef } from "react";
import { isAppleDevice } from "@react-aria/utils";
import CompactWorkspaceSwitcher from "@/components/WorkspaceSwitcher/WorkspaceSwitcher";
import { useTauriEvent } from "@/lib/tauri";
import { onOpenUrl } from "@tauri-apps/plugin-deep-link";

import handleDeepLink from "./deep";
import DesktopConnect from "@/components/DesktopConnect/DesktopConnect";

function App() {
  const cleanupImportListener = useRef<UnlistenFn | null>(null);

  const importRunbook = useStore((state: AtuinState) => state.importRunbook);
  const newRunbook = useStore((state: AtuinState) => state.newRunbook);
  const setCurrentRunbook = useStore(
    (state: AtuinState) => state.setCurrentRunbook,
  );

  const navigate = useNavigate();
  const location = useLocation();
  const user = useStore((state: AtuinState) => state.user);
  const isLoggedIn = useStore((state: AtuinState) => state.isLoggedIn);
  const showDesktopConnect = useStore(
    (state: AtuinState) => state.showDesktopConnect,
  );

  let onOpenUrlListener = useRef<UnlistenFn | null>(null);

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
      let runbook = await newRunbook();
      setCurrentRunbook(runbook.id);

      return;
    }

    navigate(`/runbooks`, { state: { createNew: true } });
  });

  useTauriEvent("new-workspace", async () => {
    navigate(`/runbooks`, { state: { createNew: true } });
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

  const navigation: SidebarItem[] = [
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
      ],
    },
  ];

  return (
    <div
      className="flex w-screen "
      style={{ maxWidth: "100vw", height: "calc(100dvh - 2rem)" }}
    >
      <CommandMenu />

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

                <DropdownSection aria-label="Help & Feedback">
                  <DropdownItem
                    key="help_and_feedback"
                    description="Get in touch"
                    onPress={() => open("https://dub.sh/atuin-desktop-beta")}
                  >
                    Help & Feedback
                  </DropdownItem>
                </DropdownSection>
              </DropdownMenu>
            </Dropdown>
          </div>
        </div>

        <Outlet />

        <Toaster />
        <Settings onOpenChange={onSettingsOpenChange} isOpen={isSettingsOpen} />

        {showDesktopConnect && <DesktopConnect />}
      </div>
    </div>
  );
}

export default App;
