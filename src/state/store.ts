import { create } from "zustand";
import { persist } from "zustand/middleware";

import { parseISO } from "date-fns";

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
import { getWeekInfo } from "@/lib/utils";
import Runbook from "./runbooks/runbook";
import { IDisposable, Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import RunbookIndexService from "./runbooks/search";
import { Settings } from "./settings";
import Workspace from "./runbooks/workspace";
import { platform } from "@tauri-apps/plugin-os";
import { open } from "@tauri-apps/plugin-dialog";
import track_event from "@/tracking";
import { KVStore } from "./kv";
import { me } from "@/api/api";

import untitledRunbook from "./runbooks/untitled.json";

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

  async write(data: string, doc: any) {
    // Template the string before we execute it
    console.log("templating with doc", doc);
    let templated: string = await invoke("template_str", {
      source: data,
      pid: this.pty,
      doc,
    });

    let isWindows = platform() == "windows";
    let cmdEnd = isWindows ? "\r\n" : "\n";
    let val = !templated.endsWith("\n") ? templated + cmdEnd : templated;

    await invoke("pty_write", { pid: this.pty, data: val });
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
  isLoggedIn: () => boolean;
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
  refreshUser: () => Promise<void>;
  refreshShellHistory: (query?: string) => void;
  historyNextPage: (query?: string) => void;

  newRunbook: () => Promise<Runbook>;
  importRunbook: () => Promise<Runbook[] | null>;
  refreshRunbooks: () => Promise<void>;

  setCurrentRunbook: (id: String) => void;
  setPtyTerm: (pty: string, terminal: any) => void;
  newPtyTerm: (pty: string) => Promise<TerminalData>;
  cleanupPtyTerm: (pty: string) => void;

  terminals: { [pty: string]: TerminalData };

  workspace: Workspace | null;
  workspaces: Workspace[];
  refreshWorkspaces: () => Promise<void>;
  newWorkspace: (name: string) => Promise<Workspace>;
  deleteWorkspace: (workspace: Workspace) => Promise<void>;
  setCurrentWorkspace: (ws: Workspace) => Promise<void>;

  showDesktopConnect: boolean;
  setDesktopConnect: (open: boolean) => void;
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
  showDesktopConnect: false,

  setSearchOpen: (open) => set(() => ({ searchOpen: open })),
  setDesktopConnect: (open) => set(() => ({ showDesktopConnect: open })),

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

  newRunbook: async (): Promise<Runbook> => {
    let runbook = await Runbook.create();
    runbook.name = "Untitled";
    runbook.content = JSON.stringify(untitledRunbook);
    runbook.save();

    await get().setCurrentRunbook(runbook.id);
    await get().refreshRunbooks();
    await get().refreshWorkspaces();

    return runbook;
  },

  importRunbook: async (): Promise<Runbook[] | null> => {
    let filePath = await open({
      multiple: true,
      directory: false,
      filters: [
        {
          name: "Atuin Runbooks",
          extensions: ["atrb"],
        },
      ],
    });

    if (!filePath || filePath.length === 0) return null;

    let runbooks = await Promise.all(
      filePath.map(async (file) => {
        // @ts-ignore
        return await Runbook.importFile(file);
      }),
    );

    console.log(runbooks);

    await get().refreshRunbooks();

    track_event("runbooks.import", {
      total: await Runbook.count(),
    });

    return runbooks;
  },

  // PERF: Yeah this won't work long term. Let's see how many runbooks people have in reality and optimize for 10x that
  refreshRunbooks: async () => {
    if (get().workspace == null) {
      await get().refreshWorkspaces();
    }

    console.log("loading runbooks for", get().workspace.name);

    let runbooks = await Runbook.all(get().workspace);
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
    try {
      let user = await me();

      if (!user) {
        set({ user: DefaultUser });
        return;
      }

      set({ user: new User(user.user.username, user.user.email, "") });
    } catch {
      set({ user: DefaultUser });
      return;
    }
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

  workspace: null,
  workspaces: [],

  refreshWorkspaces: async () => {
    let wss = await Workspace.all();
    let ws = await Workspace.current();

    for (let w of wss) {
      await w.refreshMeta();
    }

    set({ workspaces: wss, workspace: ws });
  },

  newWorkspace: async (name: string): Promise<Workspace> => {
    let ws = await Workspace.create(name);

    await get().setCurrentWorkspace(ws);
    await get().refreshWorkspaces();

    return ws;
  },

  deleteWorkspace: async (workspace: Workspace) => {
    if (get().workspace.id === workspace.id) {
      throw new Error("Cannot delete current workspace");
    }

    await workspace.delete();
    get().refreshWorkspaces();
  },

  setCurrentWorkspace: async (ws: Workspace) => {
    const kv = await KVStore.open_default();
    kv.set("current_workspace", ws.id);

    set({ workspace: ws });
    get().refreshRunbooks();
    get().setCurrentRunbook(null);
  },

  isLoggedIn: () => {
    if (!get().user) return false;
    let user = get().user;

    if (!user.isLoggedIn) return false;

    return user.isLoggedIn();
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
              "user",
            ].includes(key),
        ),
      ),
  }),
);
