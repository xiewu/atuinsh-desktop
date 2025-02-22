// @ts-ignore
import { createReactBlockSpec } from "@blocknote/react";

import "./index.css";

import { useCallback, useEffect, useState } from "react";

import { invoke } from "@tauri-apps/api/core";
import { platform } from "@tauri-apps/plugin-os";
import Terminal from "./terminal.tsx";

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

interface RunBlockProps {
  onChange: (val: string) => void;
  onRun?: (pty: string) => void;
  onStop?: (pty: string) => void;
  setName: (name: string) => void;
  id: string;
  name: string;
  code: string;
  type: string;
  pty: string;
  isEditable: boolean;
  editor: any;
  outputVisible: boolean;
  setOutputVisible: (visible: boolean) => void;
}


const RunBlock = ({
  onChange,
  id,
  name,
  setName,
  code,
  isEditable,
  onRun,
  onStop,
  editor,
  outputVisible,
  setOutputVisible,
}: RunBlockProps) => {
  const colorMode = useStore((state) => state.functionalColorMode);
  const cleanupPtyTerm = useStore((store: AtuinState) => store.cleanupPtyTerm);
  const terminals = useStore((store: AtuinState) => store.terminals);

  // isRunning = a terminal is running
  const [isRunning, setIsRunning] = useState<boolean>(false);
  // commandRunning = an individual command is running
  const [commandRunning, setCommandRunning] = useState<boolean>(false);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [commandDuration, setCommandDuration] = useState<number | null>(null);

  // This ensures that the first time we run a block, it executes the code. But subsequent mounts of an already-existing pty
  // don't run the code again.
  // We have to write to the pty from the terminal component atm, because it needs to be listening for data from the pty before
  // we write to it.
  const [firstOpen, setFirstOpen] = useState<boolean>(false);

  const [currentRunbookId] = useStore((store: AtuinState) => [store.currentRunbookId]);

  const pty = usePtyStore((store) => store.ptyForBlock(id));

  useEffect(() => {
    setIsRunning(pty != null);
  }, [pty]);


  const handleStop = async () => {
    if (pty === null) return;

    await invoke("pty_kill", { pid: pty.pid, runbook: currentRunbookId });

    terminals[pty.pid].dispose();
    cleanupPtyTerm(pty.pid);

    if (onStop) onStop(pty.pid);

    setCommandRunning(false);
    setExitCode(null);
    setCommandDuration(null);

  };

  const openPty = async (): Promise<string> => {
    let cwd = findFirstParentOfType(editor, id, "directory");

    if (cwd) {
      cwd = cwd.props.path;
    } else {
      cwd = "~";
    }

    let vars = findAllParentsOfType(editor, id, "env");
    let env: { [key: string]: string } = {};

    for (var i = 0; i < vars.length; i++) {
      let name = await templateString(id, vars[i].props.name, editor.document, currentRunbookId);
      let value = await templateString(id, vars[i].props.value, editor.document, currentRunbookId);
      env[name] = value;
    }

    // TODO: make the terminal _also_ handle opening the pty?
    // I think that would make more sense lol
    let pty = await invoke<string>("pty_open", {
      cwd,
      env,
      runbook: currentRunbookId,
      block: id,
    });

    return pty;
  };

  const handlePlay = async (force: boolean = false) => {
    if (isRunning && !force) return;
    if (!code) return;

    let pty = await openPty();
    setFirstOpen(true);

    if (onRun) onRun(pty);

    track_event("runbooks.terminal.run", {});
  };

  const handleRefresh = async () => {
    if (!isRunning) return;
    if (pty === null) return;

    let terminalData = terminals[pty.pid];

    let isWindows = platform() == "windows";
    let cmdEnd = isWindows ? "\r\n" : "\n";
    let val = !code.endsWith("\n") ? code + cmdEnd : code;

    terminalData.terminal.clear();
    terminalData.write(id, val, editor.document, currentRunbookId);
  };

  const handleCmdEnter: Command = useCallback(() => {
    if (!isRunning) {
      handlePlay();
    } else {
      handleStop();
    }

    return true;
  }, [isRunning]);

  return (
    <Block
      name={name}
      setName={setName}
      inlineHeader
      header={
        <>
          <div className="flex flex-row justify-between w-full">
            <h1 className="text-default-700 font-semibold">
              {
                <EditableHeading
                  initialText={name || "Terminal"}
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
              <Tooltip content={outputVisible ? "Hide output terminal" : "Show output terminal"}>
                <button
                  onClick={() => setOutputVisible(!outputVisible)}
                  className="p-2 hover:bg-default-100 rounded-md"
                >
                  {outputVisible ? <Eye size={20} /> : <EyeOff size={20} />}
                </button>
              </Tooltip>
            </div>
          </div>

          <div className="flex flex-row gap-2 flex-grow w-full">
            <PlayButton
              isRunning={isRunning}
              cancellable={true}
              onPlay={handlePlay}
              onStop={handleStop}
              onRefresh={handleRefresh}
            />
            <CodeEditor
              id={id}
              code={code}
              onChange={onChange}
              isEditable={isEditable}
              language="bash"
              colorMode={colorMode}
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
            "block": outputVisible && isRunning,
          })}
        >
          <Terminal
            block_id={id}
            pty={pty.pid}
            script={code}
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

      return (
        <RunBlock
          name={block.props.name}
          setName={setName}
          onChange={onInputChange}
          id={block?.id}
          code={block.props.code}
          type={block.props.type}
          pty={block.props.pty}
          isEditable={editor.isEditable}
          onRun={onRun}
          onStop={onStop}
          editor={editor}
          outputVisible={block.props.outputVisible}
          setOutputVisible={setOutputVisible}
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
