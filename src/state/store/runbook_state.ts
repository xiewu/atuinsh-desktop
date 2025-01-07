import Runbook from "../runbooks/runbook";
import RunbookIndexService from "../runbooks/search";
import Workspace from "../runbooks/workspace";
import { open } from "@tauri-apps/plugin-dialog";
import track_event from "@/tracking";
import { KVStore } from "../kv";
import Logger from "@/lib/logger";
const logger = new Logger("RunbookStore", "purple", "pink");

import untitledRunbook from "../runbooks/untitled.json";
import { StateCreator } from "zustand";

export interface AtuinRunbookState {
  runbooks: Runbook[];
  runbookIndex: RunbookIndexService;
  currentRunbookId: string | null;
  lastTagForRunbook: { [key: string]: string };

  newRunbook: () => Promise<Runbook>;
  importRunbook: () => Promise<Runbook[] | null>;
  refreshRunbooks: () => Promise<void>;
  deleteRunbookFromCache: (runbookId: string) => void;

  setCurrentRunbookId: (id: string | null) => void;
  selectTag: (runbookId: string, tag: string | null) => void;
  getLastTagForRunbook: (runbookId: string) => string | null;

  workspace: Workspace | null;
  workspaces: Workspace[];
  refreshWorkspaces: () => Promise<void>;
  newWorkspace: (name: string) => Promise<Workspace>;
  deleteWorkspace: (workspace: Workspace) => Promise<void>;
  setCurrentWorkspace: (ws: Workspace) => Promise<void>;
}

export const persistRunbookKeys: (keyof AtuinRunbookState)[] = [
  "currentRunbookId",
  "lastTagForRunbook",
];

export const createRunbookState: StateCreator<AtuinRunbookState> = (
  set,
  get,
  _store,
): AtuinRunbookState => ({
  runbooks: [],
  currentRunbookId: null,
  lastTagForRunbook: {},
  runbookIndex: new RunbookIndexService(),

  newRunbook: async (): Promise<Runbook> => {
    let runbook = await Runbook.create();
    runbook.name = "Untitled";
    runbook.content = JSON.stringify(untitledRunbook);
    runbook.save();

    get().setCurrentRunbookId(runbook.id);
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

    logger.debug("loading runbooks for", get().workspace?.name);

    let runbooks = await Runbook.all(get().workspace!);
    let index = new RunbookIndexService();
    index.bulkAddRunbooks(runbooks);

    set({ runbooks, runbookIndex: index });
  },

  deleteRunbookFromCache: (runbookId: string) => {
    const { runbooks, currentRunbookId } = get();
    const newRunbookId = currentRunbookId === runbookId ? null : currentRunbookId;
    const newRunbooks = runbooks.filter((rb) => rb.id !== runbookId);
    set({ runbooks: newRunbooks, currentRunbookId: newRunbookId });
  },

  setCurrentRunbookId: async (id: string | null) => {
    set({ currentRunbookId: id });
  },

  selectTag: (runbookId: string, tag: string | null) => {
    const obj = get().lastTagForRunbook;
    if (tag) {
      obj[runbookId] = tag;
    } else {
      delete obj[runbookId];
    }
    set({ lastTagForRunbook: obj });
  },

  getLastTagForRunbook: (runbookId?: string): string | null => {
    if (runbookId) {
      return get().lastTagForRunbook[runbookId] || null;
    } else {
      return null;
    }
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
    if (get().workspace?.id === workspace.id) {
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
    get().setCurrentRunbookId(null);
  },
});
