import "./Root.css";
import { open } from "@tauri-apps/plugin-shell";

import { Outlet, useNavigate } from "react-router-dom";
import { useStore } from "@/state/store";

import { Toaster } from "@/components/ui/toaster";
import { KeyRoundIcon } from "lucide-react";
import { Icon } from "@iconify/react";

import LoginOrRegister from "@/components/LoginOrRegister.tsx";
import Settings from "@/components/Settings/Settings.tsx";

import {
  Avatar,
  User,
  Button,
  ScrollShadow,
  Spacer,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownSection,
  DropdownTrigger,
  Modal,
  ModalContent,
  useDisclosure,
} from "@nextui-org/react";
import Sidebar, { SidebarItem } from "@/components/Sidebar";
import icon from "@/assets/icon.svg";
import { logout } from "@/state/client.ts";
import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useToast } from "@/components/ui/use-toast";
import { checkForAppUpdates } from "@/updater";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

function App() {
  const cleanupUpdateListener = useRef<UnlistenFn | null>(null);
  const navigate = useNavigate();
  const user = useStore((state: any) => state.user);
  const refreshUser = useStore((state: any) => state.refreshUser);
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const {
    isOpen: isSettingsOpen,
    onOpen: onSettingsOpen,
    onOpenChange: onSettingsOpenChange,
  } = useDisclosure();

  const [isCliInstalled, setIsCliInstalled] = useState(false);
  let { toast } = useToast();

  useEffect(() => {
    invoke<boolean>("is_cli_installed").then((cliInstalled) => {
      setIsCliInstalled(cliInstalled);
    });

    const check = () => {
      (async () => {
        await checkForAppUpdates();
      })();

      setTimeout(check, 1000 * 60 * 60);
    };

    check();

    listen("update-check", () => {
      checkForAppUpdates();
    }).then((unlisten) => {
      cleanupUpdateListener.current = unlisten;
    });

    return () => {
      if (cleanupUpdateListener.current) cleanupUpdateListener.current();
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
        {
          key: "dotfiles",
          icon: "solar:file-smile-linear",
          title: "Dotfiles",
          onPress: () => {
            navigate("/dotfiles");
          },
        },
      ],
    },
  ];

  return (
    <div
      className="flex w-screen select-none"
      style={{ maxWidth: "100vw", height: "calc(100dvh - 2rem)" }}
    >
      <div className="flex w-full">
        <div className="relative flex flex-col !border-r-small border-divider transition-width pb-6 pt-4 items-center">
          <div className="flex items-center gap-0 px-3 justify-center">
            <div className="flex h-8 w-8">
              <img src={icon} alt="icon" className="h-8 w-8" />
            </div>
          </div>

          <ScrollShadow className="-mr-6 h-full max-h-full py-6 pr-6">
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
                  <User
                    avatarProps={{
                      size: "sm",
                      name: user.username || "Anonymous User",
                      showFallback: true,
                      imgProps: {
                        className: "transition-none",
                      },
                    }}
                    classNames={{
                      name: "text-default-600",
                      description: "text-default-500",
                    }}
                    description={
                      user.bio || (user.username && "No bio") || "Sign up now"
                    }
                    name={user.username || "Anonymous User"}
                  />
                </DropdownItem>

                <DropdownItem
                  key="settings"
                  description="Configure Atuin"
                  onPress={onSettingsOpen}
                  startContent={
                    <Icon icon="solar:settings-linear" width={24} />
                  }
                >
                  Settings
                </DropdownItem>

                <DropdownSection aria-label="Help & Feedback">
                  <DropdownItem
                    key="help_and_feedback"
                    description="Get in touch"
                    onPress={() => open("https://forum.atuin.sh")}
                    startContent={
                      <Icon width={24} icon="solar:question-circle-linear" />
                    }
                  >
                    Help & Feedback
                  </DropdownItem>

                  {(user.username && (
                    <DropdownItem
                      key="logout"
                      startContent={
                        <Icon width={24} icon="solar:logout-broken" />
                      }
                      onClick={() => {
                        logout();
                        refreshUser();
                      }}
                    >
                      Log Out
                    </DropdownItem>
                  )) || (
                    <DropdownItem
                      key="signup"
                      description="Sync, backup and share your data"
                      className="bg-emerald-100"
                      startContent={<KeyRoundIcon size="18px" />}
                      onPress={onOpen}
                    >
                      Log in or Register
                    </DropdownItem>
                  )}

                  {isCliInstalled || (
                    <DropdownItem
                      key="install_cli"
                      startContent={
                        <Icon width={24} icon="iconoir:terminal-tag" />
                      }
                      onClick={async () => {
                        toast({
                          title: "Atuin CLI",
                          description: "Install in progress...",
                        });

                        console.log("Installing CLI...");
                        await invoke("install_cli");

                        console.log("Setting up plugin...");
                        await invoke("setup_cli");

                        toast({
                          title: "Atuin CLI",
                          description: "Installation complete",
                        });

                        setIsCliInstalled(true);
                      }}
                    >
                      Install Atuin CLI
                    </DropdownItem>
                  )}
                </DropdownSection>
              </DropdownMenu>
            </Dropdown>
          </div>
        </div>

        <Outlet />

        <Toaster />
        <Modal
          isOpen={isOpen}
          onOpenChange={onOpenChange}
          placement="top-center"
        >
          <ModalContent className="p-8">
            {(onClose) => (
              <>
                <LoginOrRegister onClose={onClose} />
              </>
            )}
          </ModalContent>
        </Modal>
        <Settings
          onOpen={onSettingsOpen}
          onOpenChange={onSettingsOpenChange}
          isOpen={isSettingsOpen}
        />
      </div>
    </div>
  );
}

export default App;
