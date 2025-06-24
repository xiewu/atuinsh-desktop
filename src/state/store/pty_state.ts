import { invoke, Channel } from "@tauri-apps/api/core";
import { platform } from "@tauri-apps/plugin-os";
import { FitAddon } from "@xterm/addon-fit";
import { IDisposable, Terminal } from "@xterm/xterm";
import { Settings } from "../settings";
import { WebglAddon } from "@xterm/addon-webgl";
import Logger from "@/lib/logger";
import { StateCreator } from "zustand";
import { templateString } from "../templates";
import Emittery from "emittery";

const logger = new Logger("PtyStore");

export class TerminalData extends Emittery {
  terminal: Terminal;
  fitAddon: FitAddon;
  pty: string;
  outputChannel: Channel<Uint8Array>;

  disposeResize: IDisposable;
  disposeOnData: IDisposable;

  startTime: number | null;

  constructor(pty: string, terminal: Terminal, fit: FitAddon, outputChannel: Channel<Uint8Array>) {
    super();

    this.terminal = terminal;
    this.fitAddon = fit;
    this.pty = pty;
    this.outputChannel = outputChannel;
    this.startTime = null;

    this.disposeResize = this.terminal.onResize((e) => this.onResize(e));
    this.disposeOnData = this.terminal.onData((e) => this.onData(e));
  }

  async listen() {
    this.outputChannel.onmessage = (bytes: Uint8Array) => {
      this.terminal.write(bytes);
    };
  }

  async onData(event: any) {
    logger.debug("onData", event);
    await invoke("pty_write", { pid: this.pty, data: event });
  }

  async onResize(size: { cols: number; rows: number }) {
    if (!this || !this.pty) return;
    await invoke("pty_resize", {
      pid: this.pty,
      cols: size.cols,
      rows: size.rows,
    });
  }

  async write(block_id: string, data: string, doc: any, runbook: string | null) {
    // Template the string before we execute it
    logger.debug(`templating ${runbook} with doc`, doc);
    let templated = await templateString(block_id, data, doc, runbook);

    let isWindows = platform() == "windows";
    let cmdEnd = isWindows ? "\r\n" : "\n";
    let val = !templated.endsWith("\n") ? templated + cmdEnd : templated;

    await invoke("pty_write", { pid: this.pty, data: val });
  }

  dispose() {
    this.disposeResize.dispose();
    this.disposeOnData.dispose();
    this.terminal.dispose();
    
    // Channel cleanup is automatic when reference is lost
  }

  relisten(pty: string) {
    this.pty = pty;

    this.dispose();

    this.disposeResize = this.terminal.onResize(this.onResize);
    this.disposeOnData = this.terminal.onData(this.onData);
  }
}

export interface RunbookPtyInfo {
  id: string;
  block: string;
}

export interface AtuinPtyState {
  terminals: { [pty: string]: TerminalData };

  setPtyTerm: (pty: string, terminal: any) => void;
  newPtyTerm: (pty: string, outputChannel: Channel<Uint8Array>) => Promise<TerminalData>;
  cleanupPtyTerm: (pty: string) => void;
}

export const persistPtyKeys: (keyof AtuinPtyState)[] = [];

export const createPtyState: StateCreator<AtuinPtyState> = (set, get, _store): AtuinPtyState => ({
  terminals: {},

  setPtyTerm: (pty: string, terminal: TerminalData) => {
    set({
      terminals: { ...get().terminals, [pty]: terminal },
    });
  },

  cleanupPtyTerm: (pty: string) => {
    set((state: AtuinPtyState) => {
      const terminals = Object.keys(state.terminals).reduce(
        (terms: { [pty: string]: TerminalData }, key) => {
          if (key !== pty) {
            terms[key] = state.terminals[key];
          }
          return terms;
        },
        {},
      );

      return { terminals };
    });
  },

  newPtyTerm: async (pty: string, outputChannel: Channel<Uint8Array>) => {
    // FiraCode is included as part of our build
    // We could consider including a few different popular fonts, and providing a dropdown
    // for the user to select from.
    let font = (await Settings.terminalFont()) || Settings.DEFAULT_FONT;
    let fontSize = (await Settings.terminalFontSize()) || Settings.DEFAULT_FONT_SIZE;
    let gl = await Settings.terminalGL();

    let terminal = new Terminal({
      fontFamily: `${font}, monospace`,
      fontSize: fontSize,
      rescaleOverlappingGlyphs: true,
      letterSpacing: 0,
      lineHeight: 1,
    });

    // TODO: fallback to canvas, also some sort of setting to allow disabling webgl usage
    // probs fine for now though, it's widely supported. maybe issues on linux.
    if (gl) {
      // May have font issues
      terminal.loadAddon(new WebglAddon());
    }

    let fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    let td = new TerminalData(pty, terminal, fitAddon, outputChannel);

    set({
      terminals: { ...get().terminals, [pty]: td },
    });

    await td.listen();

    return td;
  },
});
