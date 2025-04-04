// @ts-ignore
import { createReactBlockSpec } from "@blocknote/react";

import "./index.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { invoke } from "@tauri-apps/api/core";
import { platform } from "@tauri-apps/plugin-os";
import Terminal from "./terminal.tsx";

import { useBlockNoteEditor } from "@blocknote/react";

import "@xterm/xterm/css/xterm.css";
import { AtuinState, useStore } from "@/state/store.ts";
import { Chip, Spinner, Tooltip } from "@heroui/react";
import { cn, formatDuration } from "@/lib/utils.ts";
import { usePtyStore } from "@/state/ptyStore.ts";
import track_event from "@/tracking.ts";
import PlayButton from "../common/PlayButton.tsx";
import { Clock, Eye, EyeOff } from "lucide-react";
import Block from "../common/Block.tsx";
import EditableHeading from "@/components/EditableHeading/index.tsx";
import { findFirstParentOfType, findAllParentsOfType } from "../exec.ts";
import { templateString } from "@/state/templates.ts";
import CodeEditor, { TabAutoComplete } from "../common/CodeEditor/CodeEditor.tsx";
import { Command } from "@codemirror/view";
import { TerminalBlock } from "@/lib/workflow/blocks/terminal.ts";
import { logExecution } from "@/lib/exec_log.ts";
import { DependencySpec, useDependencyState } from "@/lib/workflow/dependency.ts";
import Dependency from "../common/Dependency/Dependency.tsx";
import { convertBlocknoteToAtuin } from "@/lib/workflow/blocks/convert.ts";
import { default as BlockType } from "@/lib/workflow/blocks/block.ts";
import BlockBus from "@/lib/workflow/block_bus.ts";
import {
  useBlockBusRunSubscription,
  useBlockBusStopSubscription,
} from "@/lib/hooks/useBlockBus.ts";

interface RunBlockProps {
  onChange: (val: string) => void;
  onRun?: (pty: string) => void;
  onStop?: (pty: string) => void;
  setName: (name: string) => void;
  type: string;
  pty: string;
  isEditable: boolean;
  setOutputVisible: (visible: boolean) => void;
  setDependency: (dependency: DependencySpec) => void;

  terminal: TerminalBlock;
}

const RunBlock = ({
  onChange,
  setName,
  isEditable,
  onRun,
  onStop,
  setOutputVisible,
  terminal,
  setDependency,
}: RunBlockProps) => {
  let editor = useBlockNoteEditor();
  const colorMode = useStore((state) => state.functionalColorMode);
  const cleanupPtyTerm = useStore((store: AtuinState) => store.cleanupPtyTerm);
  const terminals = useStore((store: AtuinState) => store.terminals);

  // isRunning = a terminal is running
  const [isRunning, setIsRunning] = useState<boolean>(false);
  // commandRunning = an individual command is running
  const [commandRunning, setCommandRunning] = useState<boolean>(false);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [commandDuration, setCommandDuration] = useState<number | null>(null);
  const [commandStart, setCommandStart] = useState<number | null>(null);
  const [parentBlock, setParentBlock] = useState<BlockType | null>(null);
  const elementRef = useRef<HTMLDivElement>(null);

  const unsubscribeNameChanged = useRef<(() => void) | null>(null);
  const unsubscribeDependencyChanged = useRef<(() => void) | null>(null);

  const lightModeEditorTheme = useStore((state) => state.lightModeEditorTheme);
  const darkModeEditorTheme = useStore((state) => state.darkModeEditorTheme);
  const theme = useMemo(() => {
    return colorMode === "dark" ? darkModeEditorTheme : lightModeEditorTheme;
  }, [colorMode, lightModeEditorTheme, darkModeEditorTheme]);

  const { canRun } = useDependencyState(terminal, isRunning);

  // This ensures that the first time we run a block, it executes the code. But subsequent mounts of an already-existing pty
  // don't run the code again.
  // We have to write to the pty from the terminal component atm, because it needs to be listening for data from the pty before
  // we write to it.
  const [firstOpen, setFirstOpen] = useState<boolean>(false);

  const [currentRunbookId] = useStore((store: AtuinState) => [store.currentRunbookId]);

  const pty = usePtyStore((store) => store.ptyForBlock(terminal.id));

  useEffect(() => {
    setIsRunning(pty != null);

    if (pty) {
      setCommandStart(Date.now() * 1000000);

      if (elementRef.current) {
        elementRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }

    if (!pty && commandStart) {
      logExecution(terminal, terminal.typeName, commandStart, Date.now() * 1000000, "");
      BlockBus.get().blockFinished(terminal);
      setCommandStart(null);
    }
  }, [pty]);

  const handleStop = useCallback(async () => {
    console.log("handleStop", pty);
    if (pty === null) return;

    await invoke("pty_kill", { pid: pty.pid, runbook: currentRunbookId });

    terminals[pty.pid].dispose();
    cleanupPtyTerm(pty.pid);

    if (onStop) onStop(pty.pid);

    setCommandRunning(false);
    setExitCode(null);
    setCommandDuration(null);
  }, [pty, currentRunbookId, terminal.id, terminals, cleanupPtyTerm, onStop]);

  const openPty = async (): Promise<string> => {
    let cwd = findFirstParentOfType(editor, terminal.id, "directory");

    if (cwd) {
      cwd = cwd.props.path;
    } else {
      cwd = "~";
    }

    let vars = findAllParentsOfType(editor, terminal.id, "env");
    let env: { [key: string]: string } = {};

    for (var i = 0; i < vars.length; i++) {
      let name = await templateString(
        terminal.id,
        vars[i].props.name,
        editor.document,
        currentRunbookId,
      );
      let value = await templateString(
        terminal.id,
        vars[i].props.value,
        editor.document,
        currentRunbookId,
      );
      env[name] = value;
    }

    // TODO: make the terminal _also_ handle opening the pty?
    // I think that would make more sense lol
    let pty = await invoke<string>("pty_open", {
      cwd,
      env,
      runbook: currentRunbookId,
      block: terminal.id,
    });

    return pty;
  };

  const handlePlay = useCallback(
    async (force: boolean = false) => {
      if (isRunning && !force) return;
      if (!terminal.code) return;

      await invoke("workflow_block_start_event", {
        workflow: currentRunbookId,
        block: terminal.id,
      });

      let p = await openPty();
      setFirstOpen(true);

      if (onRun) onRun(p);

      track_event("runbooks.terminal.run", {});
    },
    [isRunning, terminal.code, terminal.id, currentRunbookId, onRun, openPty],
  );

  const handleRefresh = async () => {
    if (!isRunning) return;
    if (pty === null) return;

    let terminalData = terminals[pty.pid];

    let isWindows = platform() == "windows";
    let cmdEnd = isWindows ? "\r\n" : "\n";
    let val = !terminal.code.endsWith("\n") ? terminal.code + cmdEnd : terminal.code;

    terminalData.terminal.clear();
    terminalData.write(terminal.id, val, editor.document, currentRunbookId);
  };

  const handleCmdEnter: Command = useCallback(() => {
    if (!isRunning) {
      handlePlay();
    } else {
      handleStop();
    }

    return true;
  }, [isRunning]);

  const refreshParentBlock = () => {
    if (!terminal.dependency.parent) {
      setParentBlock(null);
      return;
    }

    if (parentBlock && parentBlock.id === terminal.dependency.parent) {
      return;
    }

    let bnb = editor.document.find((b: any) => b.id === terminal.dependency.parent);
    if (bnb) {
      let block = convertBlocknoteToAtuin(bnb);
      setParentBlock(block);
    }
  };

  useEffect(() => {
    if (!terminal.dependency.parent) {
      setParentBlock(null);
      return;
    }

    if (parentBlock && parentBlock.id === terminal.dependency.parent) {
      return;
    }

    if (unsubscribeDependencyChanged.current) {
      unsubscribeDependencyChanged.current();
    }
    if (unsubscribeNameChanged.current) {
      unsubscribeNameChanged.current();
    }

    unsubscribeDependencyChanged.current = BlockBus.get().subscribeDependencyChanged(
      terminal.dependency.parent,
      refreshParentBlock,
    );
    unsubscribeNameChanged.current = BlockBus.get().subscribeNameChanged(
      terminal.dependency.parent,
      refreshParentBlock,
    );

    refreshParentBlock();

    return () => {
      if (unsubscribeDependencyChanged.current) {
        unsubscribeDependencyChanged.current();
      }
      if (unsubscribeNameChanged.current) {
        unsubscribeNameChanged.current();
      }
    };
  }, [terminal.dependency.parent]);

  useBlockBusRunSubscription(terminal.id, handlePlay);
  useBlockBusStopSubscription(terminal.id, handleStop);

  return (
    <Block
      hasDependency
      name={terminal.name}
      block={terminal}
      type={"Terminal"}
      setName={setName}
      inlineHeader
      setDependency={setDependency}
      hideChild={!terminal.outputVisible}
      header={
        <>
          <div className="flex flex-row justify-between w-full">
            <h1 className="text-default-700 font-semibold">
              {
                <EditableHeading
                  initialText={terminal.name}
                  onTextChange={(text) => setName(text)}
                />
              }
            </h1>
            <div className="flex flex-row items-center gap-2">
              {isRunning && commandRunning && <Spinner size="sm" />}
              {isRunning && commandDuration && (
                <Chip
                  variant="flat"
                  size="sm"
                  className="pl-3 py-2"
                  startContent={<Clock size={14} />}
                  color={exitCode == 0 ? "success" : "danger"}
                >
                  {formatDuration(commandDuration)}
                </Chip>
              )}
              <Tooltip
                content={terminal.outputVisible ? "Hide output terminal" : "Show output terminal"}
              >
                <button
                  onClick={() => setOutputVisible(!terminal.outputVisible)}
                  className="p-2 hover:bg-default-100 rounded-md"
                >
                  {terminal.outputVisible ? <Eye size={20} /> : <EyeOff size={20} />}
                </button>
              </Tooltip>
              <Dependency block={terminal} setDependency={setDependency} />
            </div>
          </div>

          <div className="flex flex-row gap-2 flex-grow w-full" ref={elementRef}>
            <PlayButton
              isRunning={isRunning}
              cancellable={true}
              onPlay={handlePlay}
              onStop={handleStop}
              onRefresh={handleRefresh}
              disabled={!canRun}
              alwaysStop
            />
            <CodeEditor
              id={terminal.id}
              code={terminal.code}
              onChange={onChange}
              isEditable={isEditable}
              language="bash"
              theme={theme}
              keyMap={[
                TabAutoComplete,
                {
                  key: "Mod-Enter",
                  run: handleCmdEnter,
                },
              ]}
            />
          </div>
        </>
      }
    >
      {pty && (
        <div
          className={cn(`overflow-hidden transition-all duration-300 ease-in-out min-w-0 hidden`, {
            block: terminal.outputVisible && isRunning,
          })}
        >
          <Terminal
            block_id={terminal.id}
            pty={pty.pid}
            script={terminal.code}
            runScript={firstOpen}
            setCommandRunning={setCommandRunning}
            setExitCode={setExitCode}
            setCommandDuration={setCommandDuration}
            editor={editor}
          />
        </div>
      )}
    </Block>
  );
};

export default createReactBlockSpec(
  {
    type: "run",
    propSchema: {
      type: {
        default: "bash",
      },
      name: { default: "" },
      code: { default: "" },
      pty: { default: "" },
      global: { default: false },
      outputVisible: {
        default: true,
      },
      dependency: { default: "{}" },
    },
    content: "none",
  },
  {
    // @ts-ignore
    render: ({ block, editor, code, type }) => {
      const onInputChange = (val: string) => {
        editor.updateBlock(block, {
          // @ts-ignore
          props: { ...block.props, code: val },
        });
      };

      const onRun = (pty: string) => {
        editor.updateBlock(block, {
          // @ts-ignore
          props: { ...block.props, pty: pty },
        });
      };

      const onStop = (_pty: string) => {
        editor?.updateBlock(block, {
          props: { ...block.props, pty: "" },
        });
      };

      const setName = (name: string) => {
        editor.updateBlock(block, {
          props: { ...block.props, name: name },
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
      };

      let dependency = DependencySpec.deserialize(block.props.dependency);
      let terminal = new TerminalBlock(
        block.id,
        block.props.name,
        dependency,
        block.props.code,
        block.props.outputVisible,
      );

      return (
        <RunBlock
          setName={setName}
          onChange={onInputChange}
          type={block.props.type}
          pty={block.props.pty}
          isEditable={editor.isEditable}
          onRun={onRun}
          onStop={onStop}
          setOutputVisible={setOutputVisible}
          terminal={terminal}
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
