import { useState, useEffect } from "react";
import {
  Autocomplete,
  AutocompleteItem,
  Input,
  Switch,
  Card,
  CardBody,
  Spinner,
  cn,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  Select,
  SelectItem,
  SharedSelection,
} from "@heroui/react";
import { Settings } from "@/state/settings";
import { KVStore } from "@/state/kv";
import { ask } from "@tauri-apps/plugin-dialog";
import { relaunch } from "@tauri-apps/plugin-process";
import { useStore } from "@/state/store";
import { invoke } from "@tauri-apps/api/core";
import { usePromise } from "@/lib/utils";

async function loadFonts(): Promise<string[]> {
  const fonts = await invoke<string[]>("list_fonts");
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

  function setColorMode(keys: SharedSelection) {
    useStore.getState().setColorMode(keys.currentKey as "light" | "dark" | "system");
  }

  if (isLoading) return <Spinner />;

  return (
    <Card shadow="sm">
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
          <SelectItem key="light" value="light">
            Light
          </SelectItem>
          <SelectItem key="dark" value="dark">
            Dark
          </SelectItem>
          <SelectItem key="system" value="system">
            Follow System
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
                className="input"
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

interface SettingsModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

// Main Settings component
const SettingsModal = ({ isOpen, onOpenChange }: SettingsModalProps) => {
  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="2xl"
      scrollBehavior="normal"
      disableAnimation
    >
      <ModalContent className="pb-4 max-h-[60vh]">
        {(_onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <h1 className="text-2xl font-bold">Settings</h1>
              <p className="text-small text-default-500">Customize your experience</p>
            </ModalHeader>
            <ModalBody className="overflow-scroll">
              <div className="flex flex-col gap-4">
                <GeneralSettings />
                <RunbookSettings />
              </div>
            </ModalBody>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};

export default SettingsModal;
