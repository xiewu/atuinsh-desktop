// @ts-ignore
import { createReactBlockSpec } from "@blocknote/react";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";

import { AtuinState, useStore } from "@/state/store.ts";
import { Button, Input, Select, SelectItem, Tooltip } from "@heroui/react";
import PlayButton from "../common/PlayButton.tsx";
import { FileTerminalIcon, Eye, EyeOff } from "lucide-react";
import Block from "../common/Block.tsx";
import EditableHeading from "@/components/EditableHeading/index.tsx";
import { insertOrUpdateBlock } from "@blocknote/core";
import { invoke } from "@tauri-apps/api/core";
import { uuidv7 } from "uuidv7";
import { listen } from "@tauri-apps/api/event";

import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import "@xterm/xterm/css/xterm.css";
import { findAllParentsOfType, findFirstParentOfType } from "../exec.ts";
import { templateString } from "@/state/templates.ts";
import CodeEditor, { TabAutoComplete } from "../common/CodeEditor/CodeEditor.tsx";
import { Command } from "@codemirror/view";
import { ScriptBlock as ScriptBlockType } from "@/lib/blocks/script.ts";

interface ScriptBlockProps {
  onChange: (val: string) => void;
  setName: (name: string) => void;
  isEditable: boolean;
  editor: any;
  setInterpreter: (interpreter: string) => void;

  setOutputVariable: (outputVariable: string) => void;
  setOutputVisible: (visible: boolean) => void;

  script: ScriptBlockType;
}

const ScriptBlock = ({
  onChange,
  setInterpreter,
  setName,
  isEditable,
  setOutputVariable,
  setOutputVisible,
  editor,
  script,
}: ScriptBlockProps) => {
  const colorMode = useStore((state) => state.functionalColorMode);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const [fitAddon, setFitAddon] = useState<FitAddon | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const [currentRunbookId] = useStore((store: AtuinState) => [store.currentRunbookId]);

  let interpreterCommand = useMemo(() => {
    // Handle common interpreters without a path

    if (script.interpreter == "bash") {
      return "/bin/bash -lc";
    }

    if (script.interpreter == "sh") {
      return "/bin/sh -ic";
    }

    if (script.interpreter == "zsh") {
      return "/bin/zsh -lc";
    }

    // Otherwise, assume the interpreter is a path
    return script.interpreter;
  }, [script.interpreter]);

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

  const handlePlay = async () => {
    if (!terminal) return;

    setIsRunning(true);
    terminal.clear();

    const channel = uuidv7();

    const unlisten = await listen(channel, (event) => {
      terminal.write(event.payload + "\r\n");
    });

    let cwd = findFirstParentOfType(editor, script.id, "directory");

    if (cwd) {
      cwd = cwd.props.path;
    } else {
      cwd = "~";
    }

    let vars = findAllParentsOfType(editor, script.id, "env");
    let env: { [key: string]: string } = {};

    for (var i = 0; i < vars.length; i++) {
      let name = await templateString(script.id, vars[i].props.name, editor.document, currentRunbookId);
      let value = await templateString(script.id, vars[i].props.value, editor.document, currentRunbookId);
      env[name] = value;
    }
    
    let command = await templateString(script.id, script.code, editor.document, currentRunbookId);

    await invoke("shell_exec", {
      channel: channel,
      command: command,
      interpreter: interpreterCommand,
      props: {
        runbook: currentRunbookId,
        env: env,
        cwd: cwd,
        block: {
          type: "script",
          ...script,
        },
      },
    });

    unlisten();
    setIsRunning(false);
  };

  const handleStop = () => {
    // TODO: Implement stop functionality
    setIsRunning(false);
  };

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
      name={script.name}
      setName={setName}
      inlineHeader
      hideChild={!script.outputVisible}
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

            <div className="flex flex-row gap-2">
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
                <SelectItem key="bash -c">bash</SelectItem>
                <SelectItem key="zsh -c">zsh</SelectItem>
                <SelectItem key="node -e">node</SelectItem>
                <SelectItem key="python3 -c">python3</SelectItem>
              </Select>

              <Tooltip content={script.outputVisible ? "Hide output terminal" : "Show output terminal"}>
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

          <div className="flex flex-row gap-2 flex-grow w-full">
            <PlayButton
              eventName="runbooks.script.run"
              onPlay={handlePlay}
              onStop={handleStop}
              isRunning={isRunning}
              cancellable={true}
            />

            <CodeEditor
              id={script.id}
              code={script.code}
              isEditable={isEditable}
              language={script.interpreter}
              colorMode={colorMode}
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
        </>
      }
    >
      <div 
        ref={terminalRef} 
        className="min-h-[200px] w-full" 
      />
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

      let script = new ScriptBlockType(block.id, block.props.name, block.props.code, block.props.interpreter, block.props.outputVariable, block.props.outputVisible);

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
    insertOrUpdateBlock(editor, {
      type: "script",
    });
  },
  icon: <FileTerminalIcon size={18} />,
  group: "Execute",
});
