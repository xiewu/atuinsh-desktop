import { useState, useEffect, useRef } from "react";
import "@xterm/xterm/css/xterm.css";
import { AtuinState, useStore } from "@/state/store";
import { platform } from "@tauri-apps/plugin-os";

const usePersistentTerminal = (pty: string) => {
  const newPtyTerm = useStore((store) => store.newPtyTerm);
  const terminals = useStore((store) => store.terminals);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    (async () => {
      if (!terminals.hasOwnProperty(pty)) {
        // create a new terminal and store it in the store.
        // this means we can resume the same instance even across mount/dismount
        await newPtyTerm(pty);
      }

      setIsReady(true);
    })();

    return () => {
      // We don't dispose of the terminal when the component unmounts
    };
  }, [pty, terminals, newPtyTerm]);

  return { terminalData: terminals[pty], isReady };
};

const TerminalComponent = ({
  block_id,
  pty,
  script,
  runScript,
  setCommandRunning,
  setExitCode,
  setCommandDuration,
  editor,
}: any) => {
  const terminalRef = useRef(null);
  const { terminalData, isReady } = usePersistentTerminal(pty);
  const [isAttached, setIsAttached] = useState(false);
  const [currentRunbookId] = useStore((store: AtuinState) => [store.currentRunbookId]);

  useEffect(() => {
    // no pty? no terminal
    if (pty == null) return;

    // the terminal may still be being created so hold off
    if (!isReady) return;

    terminalData.on("command_start", () => {
      setCommandRunning(true);
      setCommandDuration(null);
    });

    terminalData.on("command_end", ({ exitCode, duration }) => {
      setExitCode(exitCode);
      setCommandDuration(duration);
      setCommandRunning(false);
    });

    const windowResize = () => {
      if (!terminalData || !terminalData.fitAddon) return;

      terminalData.fitAddon.fit();
    };

    // terminal object needs attaching to a ref to a div
    if (!isAttached && terminalData && terminalData.terminal) {
      // If it's never been attached, attach it
      if (!terminalData.terminal.element && terminalRef.current) {
        terminalData.terminal.open(terminalRef.current);

        // it might have been previously attached, but need moving elsewhere
      } else if (terminalData && terminalRef.current) {
        // @ts-ignore
        terminalRef.current.appendChild(terminalData.terminal.element);
      }

      terminalData.fitAddon.fit();
      setIsAttached(true);

      window.addEventListener("resize", windowResize);

      if (runScript) {
        let isWindows = platform() == "windows";
        let cmdEnd = isWindows ? "\r\n" : "\n";
        let val = !script.endsWith("\n") ? script + cmdEnd : script;

        terminalData.write(block_id, val, editor.document, currentRunbookId);
      }
    }

    // Customize further as needed
    return () => {
      if (terminalData && terminalData.terminal && terminalData.terminal.element) {
        // Instead of removing, we just detach
        if (terminalData.terminal.element.parentElement) {
          terminalData.terminal.element.parentElement.removeChild(terminalData.terminal.element);
        }
        setIsAttached(false);
      }

      window.removeEventListener("resize", windowResize);
    };
  }, [terminalData, isReady]);

  if (!isReady) return null;

  return <div className="!max-w-full min-w-0 overflow-hidden rounded-lg" ref={terminalRef} />;
};

export default TerminalComponent;
