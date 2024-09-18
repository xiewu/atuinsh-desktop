import { create } from "zustand";
import { persist } from "zustand/middleware";

import { parseISO } from "date-fns";

import { fetch } from "@tauri-apps/plugin-http";

import {
  User,
  DefaultUser,
  HomeInfo,
  DefaultHomeInfo,
  Alias,
  ShellHistory,
  Var,
} from "./models";

import { invoke } from "@tauri-apps/api/core";
import { sessionToken, settings } from "./client";
import { getWeekInfo } from "@/lib/utils";
import Runbook from "./runbooks/runbook";
import { IDisposable, Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import RunbookIndexService from "./runbooks/search";
import { Settings } from "./settings";

export class TerminalData {
  terminal: Terminal;
  fitAddon: FitAddon;
  pty: string;

  disposeResize: IDisposable;
  disposeOnData: IDisposable;

  constructor(pty: string, terminal: Terminal, fit: FitAddon) {
    this.terminal = terminal;
    this.fitAddon = fit;
    this.pty = pty;

    this.disposeResize = this.terminal.onResize((e) => this.onResize(e));
    this.disposeOnData = this.terminal.onData((e) => this.onData(e));
  }

  async onData(event: any) {
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

  async write(data: string) {
    await invoke("pty_write", { pid: this.pty, data: data });
  }

  dispose() {
    this.disposeResize.dispose();
    this.disposeOnData.dispose();
    this.terminal.dispose();
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

// I'll probs want to slice this up at some point, but for now a
// big blobby lump of state is fine.
// Totally just hoping that structure will be emergent in the future.
//
// me, 4mo later: thanks I hate it
export interface AtuinState {
  user: User;
  homeInfo: HomeInfo;
  aliases: Alias[];
  vars: Var[];
  shellHistory: ShellHistory[];
  calendar: any[];
  weekStart: number;
  runbooks: Runbook[];
  runbookIndex: RunbookIndexService;
  currentRunbook: string | null;

  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;

  refreshHomeInfo: () => void;
  refreshCalendar: () => void;
  refreshAliases: () => void;
  refreshVars: () => void;
  refreshUser: () => void;
  refreshRunbooks: () => void;
  refreshShellHistory: (query?: string) => void;
  historyNextPage: (query?: string) => void;

  setCurrentRunbook: (id: String) => void;
  setPtyTerm: (pty: string, terminal: any) => void;
  newPtyTerm: (pty: string) => Promise<TerminalData>;
  cleanupPtyTerm: (pty: string) => void;

  terminals: { [pty: string]: TerminalData };

}

let state = (set: any, get: any): AtuinState => ({
  user: DefaultUser,
  homeInfo: DefaultHomeInfo,
  aliases: [],
  vars: [],
  shellHistory: [],
  calendar: [],
  runbooks: [],
  currentRunbook: "",
  terminals: {},
  runbookIndex: new RunbookIndexService(),

  weekStart: getWeekInfo().firstDay,

  searchOpen: false,
  setSearchOpen: (open) => set(() => ({ searchOpen: open })),

  refreshAliases: () => {
    invoke("aliases").then((aliases: any) => {
      set({ aliases: aliases });
    });
  },

  refreshCalendar: () => {
    invoke("history_calendar").then((calendar: any) => {
      set({ calendar: calendar });
    });
  },

  refreshVars: () => {
    invoke("vars").then((vars: any) => {
      set({ vars: vars });
    });
  },

  // PERF: Yeah this won't work long term. Let's see how many runbooks people have in reality and optimize for 10x that
  refreshRunbooks: async () => {
    let runbooks = await Runbook.all();
    let index = new RunbookIndexService();
    index.bulkAddRunbooks(runbooks);

    set({ runbooks, runbookIndex: index });
  },

  refreshShellHistory: (query?: string) => {
    if (query) {
      invoke("search", { query: query })
        .then((res: any) => {
          set({ shellHistory: res });
        })
        .catch((e) => {
          console.log(e);
        });
    } else {
      invoke("list").then((res: any) => {
        set({ shellHistory: res });
      });
    }
  },

  refreshHomeInfo: () => {
    invoke("home_info")
      .then((res: any) => {
        console.log(res);
        set({
          homeInfo: {
            historyCount: res.history_count,
            recordCount: res.record_count,
            lastSyncTime: (res.last_sync && parseISO(res.last_sync)) || null,
            recentCommands: res.recent_commands,
            topCommands: res.top_commands.map((top: any) => ({
              command: top[0],
              count: top[1],
            })),
          },
        });
      })
      .catch((e) => {
        console.log(e);
      });
  },

  refreshUser: async () => {
    let config = await settings();
    let session;

    try {
      session = await sessionToken();
    } catch (e) {
      console.log("Not logged in, so not refreshing user");
      set({ user: DefaultUser });
      return;
    }
    let url = config.sync_address + "/api/v0/me";

    let res = await fetch(url, {
      headers: {
        Authorization: `Token ${session}`,
      },
    });
    let me = await res.json();

    set({ user: new User(me.username) });
  },

  historyNextPage: (query?: string) => {
    let history = get().shellHistory;
    let offset = history.length - 1;

    if (query) {
      invoke("search", { query: query, offset: offset })
        .then((res: any) => {
          set({ shellHistory: [...history, ...res] });
        })
        .catch((e) => {
          console.log(e);
        });
    } else {
      invoke("list", { offset: offset }).then((res: any) => {
        set({ shellHistory: [...history, ...res] });
      });
    }
  },

  setCurrentRunbook: (id: String) => {
    set({ currentRunbook: id });
  },

  setPtyTerm: (pty: string, terminal: TerminalData) => {
    set({
      terminals: { ...get().terminals, [pty]: terminal },
    });
  },

  cleanupPtyTerm: (pty: string) => {
    set((state: AtuinState) => {
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

  newPtyTerm: async (pty: string) => {
    let font = await Settings.terminalFont();
    let gl = await Settings.terminalGL();

    let terminal = new Terminal({
      fontFamily: `${font}, monospace`,
      customGlyphs: false,
    });

    // TODO: fallback to canvas, also some sort of setting to allow disabling webgl usage
    // probs fine for now though, it's widely supported. maybe issues on linux.
    if (gl) {
      // May have font issues
      terminal.loadAddon(new WebglAddon());
    }

    let fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    let td = new TerminalData(pty, terminal, fitAddon);

    set({
      terminals: { ...get().terminals, [pty]: td },
    });

    return td;
  },
});

export const useStore = create<AtuinState>()(
  persist(state, {
    name: "atuin-storage",

    // don't serialize the terminals map
    // it won't work as JSON. too cyclical
    partialize: (state) =>
      Object.fromEntries(
        Object.entries(state).filter(
          ([key]) =>
            ![
              "terminals",
              "runbooks",
              "history_calendar",
              "home_info",
              "runbookIndex",
            ].includes(key),
        ),
      ),
  }),
);
