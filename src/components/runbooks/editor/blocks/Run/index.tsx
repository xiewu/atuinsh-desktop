// @ts-ignore
import { createReactBlockSpec } from "@blocknote/react";

import "./index.css";

import CodeMirror from "@uiw/react-codemirror";
import { keymap } from "@codemirror/view";
import { langs } from "@uiw/codemirror-extensions-langs";

import { useEffect, useState } from "react";

import { extensions } from "./extensions";
import { invoke } from "@tauri-apps/api/core";
import { platform } from "@tauri-apps/plugin-os";
import Terminal from "./terminal.tsx";

import "@xterm/xterm/css/xterm.css";
import { AtuinState, useStore } from "@/state/store.ts";
import { Chip, Spinner } from "@nextui-org/react";
import { formatDuration } from "@/lib/utils.ts";
import { usePtyStore } from "@/state/ptyStore.ts";
import track_event from "@/tracking.ts";
import PlayButton from "../common/PlayButton.tsx";
import { Clock } from "lucide-react";
import Block from "../common/Block.tsx";
import EditableHeading from "@/components/EditableHeading/index.tsx";

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
}

const findFirstParentOfType = (editor: any, id: string, type: string): any => {
  // TODO: the types for blocknote aren't working. Now I'm doing this sort of shit,
  // really need to fix that.
  const document = editor.document;
  var lastOfType = null;

  // Iterate through ALL of the blocks.
  for (let i = 0; i < document.length; i++) {
    if (document[i].id == id) return lastOfType;

    if (document[i].type == type) lastOfType = document[i];
  }

  return lastOfType;
};

const findAllParentsOfType = (editor: any, id: string, type: string): any[] => {
  const document = editor.document;
  let blocks: any[] = [];

  // Iterate through ALL of the blocks.
  for (let i = 0; i < document.length; i++) {
    if (document[i].id == id) return blocks;

    if (document[i].type == type) blocks.push(document[i]);
  }

  return blocks;
};

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
}: RunBlockProps) => {
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

    await invoke("pty_kill", { pid: pty.pid });

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
      env[vars[i].props.name] = vars[i].props.value;
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

    track_event("runbooks.script.run", {});
  };

  const handleRefresh = async () => {
    if (!isRunning) return;
    if (pty === null) return;

    let terminalData = terminals[pty.pid];

    let isWindows = platform() == "windows";
    let cmdEnd = isWindows ? "\r\n" : "\n";
    let val = !code.endsWith("\n") ? code + cmdEnd : code;

    terminalData.terminal.clear();
    terminalData.write(val, editor.document);
  };

  const handleCmdEnter = () => {
    if (isRunning) {
      handlePlay();
    } else {
      handleStop();
    }

    return true;
  };

  const customKeymap = keymap.of([
    {
      key: "Mod-Enter",
      run: handleCmdEnter,
    },
  ]);

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
            {commandRunning && <Spinner size="sm" />}
            {commandDuration && (
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
          </div>

          <div className="flex flex-row gap-2 flex-grow w-full">
            <PlayButton
              isRunning={isRunning}
              cancellable={true}
              onPlay={handlePlay}
              onStop={handleStop}
              onRefresh={handleRefresh}
            />
            <CodeMirror
              id={id}
              placeholder={"Write your script here..."}
              className="!pt-0 max-w-full border border-gray-300 rounded flex-grow"
              value={code}
              editable={isEditable}
              onChange={(val) => {
                onChange(val);
              }}
              extensions={[customKeymap, ...extensions(), langs.shell()]}
              basicSetup={false}
            />
          </div>
        </>
      }
    >
      {pty && (
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out min-w-0 ${
            isRunning ? "block" : "hidden"
          }`}
        >
          <Terminal
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
