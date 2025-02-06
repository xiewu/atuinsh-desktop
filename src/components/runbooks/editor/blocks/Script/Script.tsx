// @ts-ignore
import { createReactBlockSpec } from "@blocknote/react";

import CodeMirror from "@uiw/react-codemirror";
import { langs } from "@uiw/codemirror-extensions-langs";

import { useMemo, useState, useEffect, useRef } from "react";

import { extensions } from "../Run/extensions";
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

interface ScriptBlockProps {
  onChange: (val: string) => void;
  setName: (name: string) => void;
  id: string;
  name: string;
  code: string;
  interpreter: string;
  isEditable: boolean;
  editor: any;
  setInterpreter: (interpreter: string) => void;

  outputVariable: string;
  setOutputVariable: (outputVariable: string) => void;
  outputVisible: boolean;
  setOutputVisible: (visible: boolean) => void;
}

const ScriptBlock = ({
  onChange,
  setInterpreter,
  id,
  name,
  setName,
  code,
  isEditable,
  interpreter,
  outputVariable,
  setOutputVariable,
  outputVisible,
  setOutputVisible,
  editor,
}: ScriptBlockProps) => {
  const colorMode = useStore((state) => state.functionalColorMode);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const [fitAddon, setFitAddon] = useState<FitAddon | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const [currentRunbookId] = useStore((store: AtuinState) => [store.currentRunbookId]);

  let interpreterCommand = useMemo(() => {
    // Handle common interpreters without a path

    if (interpreter == "bash") {
      return "/bin/bash -c";
    }

    if (interpreter == "sh") {
      return "/bin/sh -c";
    }

    if (interpreter == "zsh") {
      return "/bin/zsh -c";
    }

    // Otherwise, assume the interpreter is a path
    return interpreter;
  }, [interpreter]);

  let editorLanguage = useMemo(() => {
    // Do the best we can with the interpreter name - get the language
    // TODO: consider dropdown to override this
    if (
      interpreter.indexOf("bash") != -1 ||
      interpreter.indexOf("sh") != -1 ||
      interpreter.indexOf("zsh") != -1
    ) {
      return langs.shell();
    }

    if (interpreter.indexOf("python") != -1) {
      return langs.python();
    }

    if (
      interpreter.indexOf("node") != -1 ||
      interpreter.indexOf("js") != -1 ||
      interpreter.indexOf("bun") != -1 ||
      interpreter.indexOf("deno") != -1
    ) {
      return langs.python();
    }

    if (interpreter.indexOf("lua") != -1) {
      return langs.lua();
    }

    if (interpreter.indexOf("ruby") != -1) {
      return langs.ruby();
    }

    return null;
  }, [interpreter]);

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

    await invoke("shell_exec", {
      channel: channel,
      command: code,
      interpreter: interpreterCommand,
      props: {
        runbook: currentRunbookId,
        outputVariable: outputVariable,
        env: env,
        cwd: cwd,
      },
    });

    unlisten();
    setIsRunning(false);
    console.log("script done");
  };

  const handleStop = () => {
    // TODO: Implement stop functionality
    setIsRunning(false);
  };

  return (
    <Block
      name={name}
      setName={setName}
      inlineHeader
      hideChild={!outputVisible}
      header={
        <>
          <div className="flex flex-row justify-between w-full">
            <h1 className="text-default-700 font-semibold">
              {
                <EditableHeading
                  initialText={name || "Script"}
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
                value={outputVariable}
                onValueChange={(val) => setOutputVariable(val)}
              />

              <Select
                size="sm"
                variant="flat"
                selectionMode="single"
                className="max-w-[250px]"
                selectedKeys={[interpreter]}
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

              <Tooltip content={outputVisible ? "Hide output terminal" : "Show output terminal"}>
                <Button
                  onPress={() => setOutputVisible(!outputVisible)}
                  size="sm"
                  variant="flat"
                  isIconOnly
                >
                  {outputVisible ? <Eye size={20} /> : <EyeOff size={20} />}
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
            <CodeMirror
              id={id}
              placeholder={"Write your script here..."}
              className="!pt-0 max-w-full border border-gray-300 rounded flex-grow"
              value={code}
              editable={isEditable}
              onChange={(val) => {
                onChange(val);
              }}
              extensions={editorLanguage ? [...extensions(), editorLanguage] : [...extensions()]}
              basicSetup={false}
              theme={colorMode === "dark" ? "dark" : "light"}
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

      return (
        <ScriptBlock
          name={block.props.name}
          setName={setName}
          onChange={onCodeChange}
          id={block?.id}
          code={block.props.code}
          interpreter={block.props.interpreter}
          setInterpreter={setInterpreter}
          isEditable={editor.isEditable}
          editor={editor}
          outputVariable={block.props.outputVariable}
          setOutputVariable={setOutputVariable}
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
