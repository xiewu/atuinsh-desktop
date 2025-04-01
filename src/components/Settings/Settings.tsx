import { useState, useEffect } from "react";
import { open } from "@tauri-apps/plugin-shell";
import {
  Autocomplete,
  AutocompleteItem,
  Input,
  Switch,
  Card,
  CardBody,
  Spinner,
  cn,
  Select,
  SelectItem,
  SharedSelection,
  Button,
  User,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalContent,
  Link,
} from "@heroui/react";
import { Settings } from "@/state/settings";
import { KVStore } from "@/state/kv";
import { ask } from "@tauri-apps/plugin-dialog";
import { relaunch } from "@tauri-apps/plugin-process";
import { useStore } from "@/state/store";
import { invoke } from "@tauri-apps/api/core";
import { usePromise } from "@/lib/utils";
import SocketManager from "@/socket";
import handleDeepLink from "@/routes/root/deep";
import * as api from "@/api/api";
import { useNavigate } from "react-router-dom";

async function loadFonts(): Promise<string[]> {
  const fonts = await invoke<string[]>("list_fonts");
  fonts.push("Inter");
  fonts.push("FiraCode");
  fonts.sort();
  return fonts;
}

// Custom hook for managing settings
const useSettingsState = (
  _key: any,
  initialValue: any,
  settingsGetter: any,
  settingsSetter: any,
) => {
  const [value, setValue] = useState(initialValue);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSetting = async () => {
      const savedValue = await settingsGetter();
      setValue(savedValue || initialValue);
      setIsLoading(false);
    };
    loadSetting();
  }, [settingsGetter, initialValue]);

  const updateSetting = async (newValue: any) => {
    setValue(newValue);
    await settingsSetter(newValue);
  };

  return [value, updateSetting, isLoading];
};

interface SettingsInputProps {
  label: string;
  value: string;
  onChange: (e: string) => void;
  placeholder: string;
  description: string;
  type: string;
}

// Reusable setting components
const SettingInput = ({
  label,
  value,
  onChange,
  placeholder,
  description,
  type,
}: SettingsInputProps) => (
  <Input
    label={label}
    value={value}
    type={type}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    description={description}
  />
);

interface SettingsSwitchProps {
  label: string;
  isSelected: boolean;
  onValueChange: (e: boolean) => void;
  description: string;
  className?: string;
}

const SettingSwitch = ({
  label,
  isSelected,
  onValueChange,
  description,
  className,
}: SettingsSwitchProps) => (
  <Switch
    isSelected={isSelected}
    onValueChange={onValueChange}
    className={cn("flex justify-between items-center w-full", className)}
  >
    <div className="flex flex-col">
      <span>{label}</span>
      {description && <span className="text-tiny text-default-400">{description}</span>}
    </div>
  </Switch>
);

// Settings sections
const GeneralSettings = () => {
  const fonts = usePromise(loadFonts());

  const [trackingOptIn, setTrackingOptIn, isLoading] = useSettingsState(
    "usage_tracking",
    false,
    async () => {
      const db = await KVStore.open_default();
      return await db.get("usage_tracking");
    },
    async (value: boolean) => {
      const db = await KVStore.open_default();
      await db.set("usage_tracking", value);
      const restart = await ask(
        "Atuin needs to restart to apply your changes. This won't take long!",
        {
          title: "Restart required",
          kind: "info",
          okLabel: "Restart",
          cancelLabel: "Later",
        },
      );
      if (restart) await relaunch();
    },
  );

  const colorMode = useStore((state) => state.colorMode);
  const fontSize = useStore((state) => state.fontSize);
  const fontFamily = useStore((state) => state.fontFamily);
  const sidebarClickStyle = useStore((state) => state.sidebarClickStyle);

  function setColorMode(keys: SharedSelection) {
    useStore.getState().setColorMode(keys.currentKey as "light" | "dark" | "system");
  }

  function setSidebarClickStyle(keys: SharedSelection) {
    useStore.getState().setSidebarClickStyle(keys.currentKey as "link" | "explorer");
  }

  function setFontSize(fontSize: number) {
    useStore.getState().setFontSize(fontSize);
  }

  function setFontFamily(fontFamily: any) {
    useStore.getState().setFontFamily(fontFamily);
  }

  if (isLoading) return <Spinner />;

  return (
    <Card shadow="sm" className="w-full">
      <CardBody>
        <h2 className="text-xl font-semibold">General</h2>

        <SettingSwitch
          className="mt-4"
          label="Enable usage tracking"
          isSelected={trackingOptIn}
          onValueChange={setTrackingOptIn}
          description="Track usage and errors to improve Atuin"
        />
        <Select
          label="Color Mode"
          value={colorMode}
          onSelectionChange={setColorMode}
          className="mt-8"
          placeholder="Select color mode"
          selectedKeys={[colorMode]}
        >
          <SelectItem key="light" textValue="Light">
            Light
          </SelectItem>
          <SelectItem key="dark" textValue="Dark">
            Dark
          </SelectItem>
          <SelectItem key="system" textValue="System">
            Follow System
          </SelectItem>
        </Select>
        <div className="flex flex-row gap-4 mt-4">
          <Autocomplete
            label="Font"
            value={fontFamily}
            selectedKey={fontFamily}
            onSelectionChange={setFontFamily}
            description="Font to use for the Runbook editor"
            defaultItems={fonts?.map((font) => ({ label: font, key: font })) || []}
          >
            {(item) => <AutocompleteItem key={item.key}>{item.label}</AutocompleteItem>}
          </Autocomplete>

          <div>
            <Input
              label="Font Size"
              type="number"
              value={fontSize.toString()}
              onChange={(e) => setFontSize(parseInt(e.target.value))}
            />
          </div>
        </div>
        <Select
          label="Runbook selection style"
          value={sidebarClickStyle}
          onSelectionChange={setSidebarClickStyle}
          className="mt-2"
          placeholder="Select sidebar click style"
          selectedKeys={[sidebarClickStyle]}
        >
          <SelectItem key="link" textValue="Click to open">
            Click to open
          </SelectItem>
          <SelectItem key="explorer" textValue="Click to select, double click to open">
            Click to select, double click to open
          </SelectItem>
        </Select>
      </CardBody>
    </Card>
  );
};

const RunbookSettings = () => {
  const fonts = usePromise(loadFonts());

  const [terminalFont, setTerminalFont, fontLoading] = useSettingsState(
    "terminal_font",
    "",
    Settings.terminalFont,
    Settings.terminalFont,
  );
  const [terminalFontSize, setTerminalFontSize, fontSizeLoading] = useSettingsState(
    "terminal_font_size",
    "",
    Settings.terminalFontSize,
    Settings.terminalFontSize,
  );
  const [terminalGl, setTerminalGl, glLoading] = useSettingsState(
    "terminal_gl",
    false,
    Settings.terminalGL,
    Settings.terminalGL,
  );
  const [prometheusUrl, setPrometheusUrl, urlLoading] = useSettingsState(
    "prometheus_url",
    "http://localhost:9090",
    Settings.runbookPrometheusUrl,
    Settings.runbookPrometheusUrl,
  );

  if (fontLoading || glLoading || urlLoading || fontSizeLoading || !fonts) return <Spinner />;

  return (
    <>
      <Card shadow="sm">
        <CardBody className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Terminal</h2>
          <div className="flex flex-row gap-4">
            <Autocomplete
              label="Terminal font"
              selectedKey={terminalFont}
              onSelectionChange={setTerminalFont}
              description="Font to use for the terminal"
              defaultItems={fonts.map((font) => ({ label: font, key: font }))}
            >
              {(item) => <AutocompleteItem key={item.key}>{item.label}</AutocompleteItem>}
            </Autocomplete>
            <div>
              <Input
                type="number"
                value={terminalFontSize || Settings.DEFAULT_FONT_SIZE}
                onChange={(e) => setTerminalFontSize(parseInt(e.target.value))}
                label="Font Size"
              />
            </div>
          </div>
          <SettingSwitch
            label="Enable WebGL rendering"
            isSelected={terminalGl}
            onValueChange={setTerminalGl}
            description="May have issues with some fonts"
          />
        </CardBody>
      </Card>

      <Card shadow="sm">
        <CardBody className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Prometheus</h2>
          <SettingInput
            type="url"
            label="Prometheus server URL"
            value={prometheusUrl}
            onChange={setPrometheusUrl}
            placeholder="http://localhost:9090"
            description="URL for querying metrics (can be overridden per-block)"
          />
        </CardBody>
      </Card>
    </>
  );
};

type AuthTokenModalProps = {
  onSubmit: (token: string) => void;
};

const AuthTokenModal = (props: AuthTokenModalProps) => {
  const [token, setToken] = useState("");
  const [validToken, setValidToken] = useState(false);

  useEffect(() => {
    const valid = token.length == 54 && token.startsWith("atapi_");
    setValidToken(valid);
  }, [token]);

  return (
    <Modal isOpen={true} size="lg">
      <ModalContent>
        <ModalHeader>Log in via auth token</ModalHeader>
        <ModalBody>
          <Input
            type="password"
            label="Paste your token here"
            value={token}
            onValueChange={setToken}
          />
        </ModalBody>
        <ModalFooter>
          <Button
            isDisabled={!validToken}
            color="success"
            variant="flat"
            onPress={() => props.onSubmit(token)}
          >
            Submit
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

const UserSettings = () => {
  const navigate = useNavigate();
  const user = useStore((state) => state.user);
  const refreshUser = useStore((state) => state.refreshUser);
  const [modalOpen, setModalOpen] = useState(false);

  async function logOut() {
    await api.clearHubApiToken();
    SocketManager.setApiToken(null);
    refreshUser();
  }

  function handleTokenSubmit(token: string) {
    setModalOpen(false);
    const deepLink = `atuin://register-token/${token}`;
    // token submit deep link doesn't require a runbook activation,
    // so passing an empty function for simplicity
    handleDeepLink(
      navigate,
      deepLink,
      () => {},
      () => {},
    );
  }

  let content;
  if (!user || !user.isLoggedIn()) {
    content = (
      <>
        <p>You are not logged in.</p>
        <div className="flex flex-row gap-2 items-center">
          <Button
            onPress={() => open(`${api.endpoint()}/settings/desktop-connect`)}
            color="success"
            variant="flat"
            className="grow"
          >
            Log in via Atuin Hub
          </Button>
          or
          <Button
            onPress={() => setModalOpen(true)}
            color="primary"
            variant="flat"
            className="grow"
          >
            Log in via auth token
          </Button>
        </div>
      </>
    );
  } else {
    content = (
      <>
        <User
          name={""}
          avatarProps={{ src: user.avatar_url || undefined }}
          description={
            <Link
              isExternal
              href={`${api.endpoint()}/${user.username}`}
              onPress={() => {
                open(`${api.endpoint()}/${user.username}`);
              }}
            >
              {user.username}
            </Link>
          }
          classNames={{ base: "mt-2 justify-start" }}
        />
        <Button onPress={logOut} color="danger" variant="flat">
          Sign out
        </Button>
      </>
    );
  }

  return (
    <Card shadow="sm">
      <CardBody>
        <h2 className="text-xl font-semibold">User</h2>
        <div className="flex flex-col gap-4">{content}</div>
        {modalOpen && <AuthTokenModal onSubmit={handleTokenSubmit} />}
      </CardBody>
    </Card>
  );
};

// Main Settings component
const SettingsPanel = () => {
  return (
    <div className="flex flex-col gap-4 p-4 pt-2 w-full overflow-y-auto">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-small text-default-400 uppercase font-semibold">
          Customize your experience
        </p>
      </div>
      <div className="flex flex-col gap-4">
        <GeneralSettings />
        <RunbookSettings />
        <UserSettings />
      </div>
    </div>
  );
};

export default SettingsPanel;
