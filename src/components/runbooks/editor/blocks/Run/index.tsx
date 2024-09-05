// @ts-ignore
import { createReactBlockSpec } from "@blocknote/react";

import "./index.css";

import CodeMirror from "@uiw/react-codemirror";
import { keymap } from "@codemirror/view";
import { langs } from "@uiw/codemirror-extensions-langs";

import { Play, Square } from "lucide-react";
import { useEffect, useState } from "react";

import { extensions } from "./extensions";
import { invoke } from "@tauri-apps/api/core";
import Terminal from "./terminal.tsx";

import "@xterm/xterm/css/xterm.css";
import { AtuinState, RunbookInfo, useStore } from "@/state/store.ts";
import { Card, CardBody, CardHeader } from "@nextui-org/react";
import { cn } from "@/lib/utils.ts";
import { usePtyStore } from "@/state/ptyStore.ts";
import track_event from "@/tracking.ts";

interface RunBlockProps {
  onChange: (val: string) => void;
  onRun?: (pty: string) => void;
  onStop?: (pty: string) => void;
  id: string;
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
  code,
  isEditable,
  onRun,
  onStop,
  editor,
}: RunBlockProps) => {
  const [value, setValue] = useState<String>(code);
  const cleanupPtyTerm = useStore((store: AtuinState) => store.cleanupPtyTerm);
  const terminals = useStore((store: AtuinState) => store.terminals);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  // This ensures that the first time we run a block, it executes the code. But subsequent mounts of an already-existing pty
  // don't run the code again.
  // We have to write to the pty from the terminal component atm, because it needs to be listening for data from the pty before
  // we write to it.
  const [firstOpen, setFirstOpen] = useState<boolean>(false);

  const [currentRunbook, runbookInfo, setRunbookInfo] = useStore(
    (store: AtuinState) => [
      store.currentRunbook,
      store.getRunbookInfo(store.currentRunbook!),
      store.setRunbookInfo,
    ],
  );

  const pty = usePtyStore((store) => store.ptyForBlock(id));

  useEffect(() => {
    setIsRunning(pty != null);
  }, [pty]);

  const handleToggle = async (event: any | null) => {
    if (event) event.stopPropagation();

    // If there's no code, don't do anything
    if (!value) return;

    if (isRunning && pty != null) {
      await invoke("pty_kill", { pid: pty.pid });

      terminals[pty.pid].terminal.dispose();
      cleanupPtyTerm(pty.pid);

      if (onStop) onStop(pty.pid);

      if (runbookInfo) {
        let rbi = runbookInfo.clone();
        rbi.removePty(id);
        setRunbookInfo(rbi);
      }
    }

    if (!isRunning) {
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
        runbook: currentRunbook,
        block: id,
      });
      setFirstOpen(true);

      if (onRun) onRun(pty);

      track_event("runbooks.script.run", {});

      if (runbookInfo) {
        let rbi = runbookInfo.clone();
        rbi.addPty(id, pty);
        setRunbookInfo(rbi);
      } else {
        let rbi = new RunbookInfo(currentRunbook!, {
          [id]: { id: pty, block: id },
        });
        rbi.addPty(id, pty);
        setRunbookInfo(rbi);
      }
    }
  };

  const handleCmdEnter = () => {
    handleToggle(null);
    return true;
  };

  const customKeymap = keymap.of([
    {
      key: "Mod-Enter",
      run: handleCmdEnter,
    },
  ]);

  return (
    <Card
      className="w-full !max-w-full !outline-none overflow-none"
      shadow="sm"
    >
      <CardHeader className="flex flex-row items-start">
        <button
          onClick={handleToggle}
          className={`flex items-center justify-center flex-shrink-0 w-8 h-8 mr-2 rounded border focus:outline-none focus:ring-2 transition-all duration-300 ease-in-out ${
            isRunning
              ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-300 focus:ring-red-300"
              : "border-green-200 bg-green-50 text-green-600 hover:bg-green-100 hover:border-green-300 focus:ring-green-300"
          }`}
          aria-label={isRunning ? "Stop code" : "Run code"}
        >
          <span
            className={`inline-block transition-transform duration-300 ease-in-out ${isRunning ? "rotate-180" : ""}`}
          >
            {isRunning ? <Square size={16} /> : <Play size={16} />}
          </span>
        </button>
        <CodeMirror
          id={id}
          placeholder={"Write your script here..."}
          className="!pt-0 max-w-full border border-gray-300 rounded flex-grow"
          value={code}
          editable={isEditable}
          onChange={(val) => {
            setValue(val);
            onChange(val);
          }}
          extensions={[customKeymap, ...extensions(), langs.shell()]}
          basicSetup={false}
        />
      </CardHeader>
      <CardBody
        className={cn({
          hidden: !isRunning,
        })}
      >
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out min-w-0 ${
            isRunning ? "block" : "hidden"
          }`}
        >
          {pty && (
            <Terminal pty={pty.pid} script={value} runScript={firstOpen} />
          )}
        </div>
      </CardBody>
    </Card>
  );
};

export default createReactBlockSpec(
  {
    type: "run",
    propSchema: {
      type: {
        default: "bash",
      },
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

      return (
        <RunBlock
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
