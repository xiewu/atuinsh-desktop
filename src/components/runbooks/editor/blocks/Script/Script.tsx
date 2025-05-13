// @ts-ignore
import { createReactBlockSpec, useEditorChange, useEditorContentOrSelectionChange } from "@blocknote/react";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";

import { AtuinState, useStore } from "@/state/store.ts";
import { addToast, Button, Input, Select, SelectItem, Tooltip } from "@heroui/react";
import PlayButton from "../common/PlayButton.tsx";
import { FileTerminalIcon, Eye, EyeOff, TriangleAlertIcon } from "lucide-react";
import Block from "../common/Block.tsx";
import EditableHeading from "@/components/EditableHeading/index.tsx";
import { insertOrUpdateBlock } from "@blocknote/core";
import { uuidv7 } from "uuidv7";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import "@xterm/xterm/css/xterm.css";
import { findAllParentsOfType, findFirstParentOfType } from "../exec.ts";
import { templateString } from "@/state/templates.ts";
import CodeEditor, { TabAutoComplete } from "../common/CodeEditor/CodeEditor.tsx";
import { Command } from "@codemirror/view";
import { ScriptBlock as ScriptBlockType } from "@/lib/workflow/blocks/script.ts";
import { default as BlockType } from "@/lib/workflow/blocks/block.ts";
import { convertBlocknoteToAtuin } from "@/lib/workflow/blocks/convert.ts";
import { DependencySpec, useDependencyState } from "@/lib/workflow/dependency.ts";
import BlockBus from "@/lib/workflow/block_bus.ts";
import {
  useBlockBusRunSubscription,
  useBlockBusStopSubscription,
} from "@/lib/hooks/useBlockBus.ts";
import SSHBus from "@/lib/buses/ssh.ts";
import { useBlockDeleted } from "@/lib/buses/editor.ts";
import { useBlockInserted } from "@/lib/buses/editor.ts";
import track_event from "@/tracking";
import { invoke } from "@tauri-apps/api/core";
import { buildInterpreterCommand } from "../common/InterpreterSelector.tsx";

interface ScriptBlockProps {
  onChange: (val: string) => void;
  setName: (name: string) => void;
  isEditable: boolean;
  editor: any;
  setInterpreter: (interpreter: string) => void;

  setOutputVariable: (outputVariable: string) => void;
  setOutputVisible: (visible: boolean) => void;
  setDependency: (dependency: DependencySpec) => void;

  script: ScriptBlockType;
}

// Supported shells with their possible paths
const supportedShells = [
  { id: "bash", name: "bash", paths: ["/bin/bash"], defaultArgs: "-lc", sshArgs: "-l" },
  { id: "zsh", name: "zsh", paths: ["/bin/zsh"], defaultArgs: "-lc", sshArgs: "-l" },
  { id: "fish", name: "fish", paths: ["/usr/bin/fish", "/usr/local/bin/fish", "/opt/homebrew/bin/fish"], defaultArgs: "-c", sshArgs: "" },
  { id: "python3", name: "python3", paths: ["/usr/bin/python3", "/usr/local/bin/python3"], defaultArgs: "-c", sshArgs: "" },
  { id: "node", name: "node", paths: ["/usr/bin/node", "/usr/local/bin/node"], defaultArgs: "-e", sshArgs: "" },
  { id: "sh", name: "sh", paths: ["/bin/sh"], defaultArgs: "-ic", sshArgs: "-i" },
];

const ScriptBlock = ({
  onChange,
  setInterpreter,
  setName,
  isEditable,
  setOutputVariable,
  setOutputVisible,
  setDependency,
  editor,
  script,
}: ScriptBlockProps) => {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const [fitAddon, setFitAddon] = useState<FitAddon | null>(null);
  const [pid, setPid] = useState<number | null>(null);
  // Track available shells
  const [availableShells, setAvailableShells] = useState<Record<string, boolean>>({});


  // Check if selected shell is missing
  const shellMissing = useMemo(() => {
    // These shells are always available
    if (script.interpreter === "bash" || script.interpreter === "sh") return false;

    // Check if shell is in our supported list but not available
    return script.interpreter in availableShells && !availableShells[script.interpreter];
  }, [script.interpreter, availableShells]);

  const colorMode = useStore((state) => state.functionalColorMode);
  const terminalRef = useRef<HTMLDivElement>(null);
  const [currentRunbookId] = useStore((store: AtuinState) => [store.currentRunbookId]);
  const [parentBlock, setParentBlock] = useState<BlockType | null>(null);
  const { canRun } = useDependencyState(script, isRunning);
  const channelRef = useRef<string | null>(null);
  const elementRef = useRef<HTMLDivElement>(null);
  const unlisten = useRef<UnlistenFn | null>(null);
  const tauriUnlisten = useRef<UnlistenFn | null>(null);
  const lightModeEditorTheme = useStore((state) => state.lightModeEditorTheme);
  const darkModeEditorTheme = useStore((state) => state.darkModeEditorTheme);
  const theme = useMemo(() => {
    return colorMode === "dark" ? darkModeEditorTheme : lightModeEditorTheme;
  }, [colorMode, lightModeEditorTheme, darkModeEditorTheme]);

  const [sshParent, setSshParent] = useState<any | null>(null);

  const updateSshParent = useCallback(() => {
    let host = findFirstParentOfType(editor, script.id, ["ssh-connect", "host-select"]);
    if (host?.type === "ssh-connect") {
      setSshParent(host);
    } else {
      setSshParent(null);
    }
  }, [editor, script.id]);

  useEffect(updateSshParent, []);

  useBlockInserted("ssh-connect", updateSshParent);
  useBlockInserted("host-select", updateSshParent);
  useBlockDeleted("ssh-connect", updateSshParent);
  useBlockDeleted("host-select", updateSshParent);

  // Class name for SSH indicator styling based on connection status
  const blockBorderClass = useMemo(() => {
    if (shellMissing) {
      return "border-2 border-red-400 shadow-[0_0_10px_rgba(239,68,68,0.4)] rounded-md transition-all duration-300";
    }

    if (sshParent) {
      return "border-2 border-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.4)] rounded-md transition-all duration-300";
    }

    return "";
  }, [sshParent, shellMissing]);

  // For the shell warning message in the top right
  const topRightWarning = useMemo(() => {
    if (shellMissing) {
      return (
        <div className="flex items-center gap-1 text-[10px] font-medium text-red-500">
          <div className="flex items-center">
            <TriangleAlertIcon size={16} />
          </div>
          {script.interpreter} not found
        </div>
      );
    }
    return null;
  }, [shellMissing, script.interpreter]);

  let interpreterCommand = useMemo(() => {
    return buildInterpreterCommand(script.interpreter, sshParent !== null);
  }, [script.interpreter, supportedShells, sshParent]);

  // Check which shells are installed
  useEffect(() => {
    const checkShellsAvailable = async () => {
      try {
        const shellStatus: Record<string, boolean> = {};

        // Check each supported shell
        for (const shell of supportedShells) {
          // Skip bash and sh as they're always available
          if (shell.id === "bash" || shell.id === "sh") {
            shellStatus[shell.id] = true;
            continue;
          }

          // Check each possible path for this shell
          let found = false;
          for (const path of shell.paths) {
            try {
              const exists = await invoke<boolean>("check_binary_exists", { path });
              if (exists) {
                found = true;
                break;
              }
            } catch (e) {
              console.error(`Error checking ${path}:`, e);
            }
          }

          shellStatus[shell.id] = found;
        }

        setAvailableShells(shellStatus);
      } catch (error) {
        console.error("Failed to check available shells:", error);
      }
    };

    checkShellsAvailable();
  }, [supportedShells]);

  // Initialize terminal
  useEffect(() => {
    const term = new Terminal({
      fontFamily: "FiraCode, monospace",
      fontSize: 14,
      convertEol: true,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);

    // Add WebGL support
    try {
      term.loadAddon(new WebglAddon());
    } catch (e) {
      console.warn("WebGL addon failed to load", e);
    }

    setTerminal(term);
    setFitAddon(fit);

    return () => {
      term.dispose();
    };
  }, []);

  // Handle terminal attachment
  useEffect(() => {
    if (!terminal || !terminalRef.current) return;

    terminal.open(terminalRef.current);
    fitAddon?.fit();

    const handleResize = () => fitAddon?.fit();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [terminal, fitAddon]);

  // handle dependency change
  useEffect(() => {
    if (!script.dependency.parent) {
      setParentBlock(null);
      return;
    }

    if (parentBlock && parentBlock.id === script.dependency.parent) {
      return;
    }

    let bnb = editor.document.find((b: any) => b.id === script.dependency.parent);
    if (bnb) {
      let block = convertBlocknoteToAtuin(bnb);
      setParentBlock(block);
    }
  }, [script.dependency]);

  const handlePlay = useCallback(async () => {
    if (!terminal) return;
    if (isRunning || unlisten.current) return;

    setIsRunning(true);
    terminal.clear();

    const channel = uuidv7();
    channelRef.current = channel;

    unlisten.current = await listen(channel, (event) => {
      terminal.write(event.payload + "\r\n");
    });

    let cwd = findFirstParentOfType(editor, script.id, "directory");
    let connectionBlock = findFirstParentOfType(editor, script.id, ["ssh-connect", "host-select"]);

    if (cwd) {
      cwd = cwd.props.path || "~";
    } else {
      cwd = "~";
    }

    let vars = findAllParentsOfType(editor, script.id, "env");
    let env: { [key: string]: string } = {};

    for (var i = 0; i < vars.length; i++) {
      let name = await templateString(
        script.id,
        vars[i].props.name,
        editor.document,
        currentRunbookId,
      );
      let value = await templateString(
        script.id,
        vars[i].props.value,
        editor.document,
        currentRunbookId,
      );
      env[name] = value;
    }

    let command = await templateString(script.id, script.code, editor.document, currentRunbookId);

    if (elementRef.current) {
      elementRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    if (connectionBlock && connectionBlock.type === "ssh-connect") {
      try {
        let [username, host] = connectionBlock.props.userHost.split("@");

        tauriUnlisten.current = await listen("ssh_exec_finished:" + channel, async () => {
          onStop();
        });

        await invoke<string>("ssh_exec", {
          host: host,
          username: username,
          command: command,
          interpreter: interpreterCommand,
          channel: channel,
        });
        SSHBus.get().updateConnectionStatus(connectionBlock.props.userHost, "success");
      } catch (error) {
        console.error("SSH connection failed:", error);
        terminal.write("SSH connection failed\r\n");
        addToast({
          title: `ssh ${connectionBlock.props.userHost}`,
          description: `${error}`,
          color: "danger",
        });
        SSHBus.get().updateConnectionStatus(connectionBlock.props.userHost, "error");
        onStop();
      }

      return;
    }

    let pid = await invoke<number>("shell_exec", {
      channel: channel,
      command: command,
      interpreter: interpreterCommand,
      props: {
        runbook: currentRunbookId,
        env: env,
        cwd: cwd,
        block: {
          type: "script",
          ...script.object(),
        },
      },
    });

    setPid(pid);

    tauriUnlisten.current = await listen("shell_exec_finished:" + pid, async () => {
      onStop();
    });
  }, [script, terminal, editor.document]);

  const onStop = useCallback(async () => {
    unlisten.current?.();
    tauriUnlisten.current?.();

    unlisten.current = null;
    tauriUnlisten.current = null;

    setIsRunning(false);
    BlockBus.get().blockFinished(script);
  }, [pid]);

  const handleStop = async () => {
    // Check for SSH block or Host block, prioritizing SSH if both exist
    let connectionBlock = findFirstParentOfType(editor, script.id, ["ssh-connect", "host-select"]);

    // Use SSH cancel for SSH blocks
    if (connectionBlock && connectionBlock.type === "ssh-connect") {
      await invoke("ssh_exec_cancel", { channel: channelRef.current });
    } else {
      // For Host blocks or no connection block, use local process termination
      if (pid) {
        await invoke("term_process", { pid: pid });
      }
    }
    setIsRunning(false);
    onStop();
  };

  useBlockBusRunSubscription(script.id, handlePlay);
  useBlockBusStopSubscription(script.id, handleStop);

  const handleCmdEnter: Command = useCallback(() => {
    if (!isRunning) {
      handlePlay();
    } else {
      handleStop();
    }

    return true;
  }, [handlePlay, handleStop, isRunning]);

  return (
    <Block
      hasDependency
      block={script}
      setDependency={setDependency}
      name={script.name}
      type={"Script"}
      setName={setName}
      inlineHeader
      hideChild={!script.outputVisible}
      className={blockBorderClass}
      topRightElement={topRightWarning}
      header={
        <>
          <div className="flex flex-row justify-between w-full">
            <h1 className="text-default-700 font-semibold">
              {
                <EditableHeading
                  initialText={script.name || "Script"}
                  onTextChange={(text) => setName(text)}
                />
              }
            </h1>

            <div className="flex flex-row items-center gap-2" ref={elementRef}>
              <Input
                size="sm"
                variant="flat"
                className="max-w-[250px]"
                placeholder="Output variable"
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck="false"
                value={script.outputVariable}
                onValueChange={(val) => setOutputVariable(val)}
              />

              <Select
                size="sm"
                variant="flat"
                selectionMode="single"
                className="max-w-[250px]"
                selectedKeys={[script.interpreter]}
                onSelectionChange={(e) => {
                  if (!e.currentKey) return;
                  setInterpreter(e.currentKey);
                }}
              >
                {supportedShells.map(shell => {
                  // Always show bash and sh, or any shell that's available, or the current selected shell
                  const shouldShow = shell.id === "bash" ||
                    shell.id === "sh" ||
                    availableShells[shell.id] ||
                    script.interpreter === shell.id;

                  return shouldShow ? (
                    <SelectItem key={shell.id} aria-label={shell.name}>
                      {shell.name}
                    </SelectItem>
                  ) : null;
                })}
              </Select>

              <Tooltip
                content={script.outputVisible ? "Hide output terminal" : "Show output terminal"}
              >
                <Button
                  onPress={() => setOutputVisible(!script.outputVisible)}
                  size="sm"
                  variant="flat"
                  isIconOnly
                >
                  {script.outputVisible ? <Eye size={20} /> : <EyeOff size={20} />}
                </Button>
              </Tooltip>
            </div>
          </div>

          <div className="flex flex-row gap-2 flex-grow w-full overflow-x-auto">
            <Tooltip
              content={shellMissing ? `${script.interpreter} shell not found. This script may not run correctly.` : ""}
              isDisabled={!shellMissing}
              color="danger"
            >
              <div>
                <PlayButton
                  disabled={!canRun}
                  eventName="runbooks.block.execute" eventProps={{ type: "script" }}
                  onPlay={handlePlay}
                  onStop={handleStop}
                  isRunning={isRunning}
                  cancellable={true}
                />
              </div>
            </Tooltip>

            <div className="min-w-0 flex-1 overflow-x-auto">
              <CodeEditor
                id={script.id}
                code={script.code}
                isEditable={isEditable}
                language={script.interpreter}
                theme={theme}
                onChange={onChange}
                keyMap={[
                  TabAutoComplete,
                  {
                    key: "Mod-Enter",
                    run: handleCmdEnter,
                  },
                ]}
              />
            </div>
          </div>
        </>
      }
    >
      <div ref={terminalRef} className="min-h-[200px] w-full" />
    </Block>
  );
};

export default createReactBlockSpec(
  {
    type: "script",
    propSchema: {
      interpreter: {
        default: "zsh",
      },
      outputVariable: {
        default: "",
      },
      name: {
        default: "",
      },
      code: { default: "" },
      outputVisible: {
        default: true,
      },
      dependency: {
        default: "{}",
      },
    },
    content: "none",
  },
  {
    // @ts-ignore
    render: ({ block, editor }) => {
      const onCodeChange = (val: string) => {
        editor.updateBlock(block, {
          // @ts-ignore
          props: { ...block.props, code: val },
        });
      };

      const setName = (name: string) => {
        editor.updateBlock(block, {
          props: { ...block.props, name: name },
        });

        BlockBus.get().nameChanged(
          new ScriptBlockType(
            block.id,
            name,
            DependencySpec.deserialize(block.props.dependency),
            block.props.code,
            block.props.interpreter,
            block.props.outputVariable,
            block.props.outputVisible,
          ),
        );
      };

      const setInterpreter = (interpreter: string) => {
        editor.updateBlock(block, {
          props: { ...block.props, interpreter: interpreter },
        });
      };

      const setOutputVariable = (outputVariable: string) => {
        editor.updateBlock(block, {
          props: { ...block.props, outputVariable: outputVariable },
        });
      };

      const setOutputVisible = (visible: boolean) => {
        editor.updateBlock(block, {
          props: { ...block.props, outputVisible: visible },
        });
      };

      const setDependency = (dependency: DependencySpec) => {
        editor.updateBlock(block, {
          props: { ...block.props, dependency: dependency.serialize() },
        });

        BlockBus.get().dependencyChanged(
          new ScriptBlockType(
            block.id,
            block.props.name,
            dependency,
            block.props.code,
            block.props.interpreter,
            block.props.outputVariable,
            block.props.outputVisible,
          ),
        );
      };

      let dependency = DependencySpec.deserialize(block.props.dependency);
      let script = new ScriptBlockType(
        block.id,
        block.props.name,
        dependency,
        block.props.code,
        block.props.interpreter,
        block.props.outputVariable,
        block.props.outputVisible,
      );

      return (
        <ScriptBlock
          script={script}
          setName={setName}
          onChange={onCodeChange}
          setInterpreter={setInterpreter}
          isEditable={editor.isEditable}
          editor={editor}
          setOutputVariable={setOutputVariable}
          setOutputVisible={setOutputVisible}
          setDependency={setDependency}
        />
      );
    },
    toExternalHTML: ({ block }) => {
      return (
        <pre lang="beep boop">
          <code lang="bash">{block?.props?.code}</code>
        </pre>
      );
    },
  },
);

export const insertScript = (schema: any) => (editor: typeof schema.BlockNoteEditor) => ({
  title: "Script",
  subtext: "Non-interactive script (bash)",
  onItemClick: () => {
    track_event("runbooks.block.create", { type: "script" });

    let scriptBlocks = editor.document.filter((block: any) => block.type === "script");
    let name = `Script ${scriptBlocks.length + 1}`;

    insertOrUpdateBlock(editor, {
      type: "script",
      // @ts-ignore
      props: {
        name: name,
      },
    });
  },
  icon: <FileTerminalIcon size={18} />,
  group: "Execute",
});
