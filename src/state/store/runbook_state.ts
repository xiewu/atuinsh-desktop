import Runbook from "../runbooks/runbook";
import { open } from "@tauri-apps/plugin-dialog";
import Logger from "@/lib/logger";
const logger = new Logger("RunbookStore", "purple", "pink");

import { StateCreator } from "zustand";

export const SET_RUNBOOK_TAG = Symbol("set_runbook_tag");

export interface AtuinRunbookState {
  runbooks: Runbook[];

  // The ID of the runbook that is currently being executed
  // Right now we do not support concurrent or background runbook execution
  serialExecution: string | null;
  currentRunbookId: string | null;
  lastTagForRunbook: { [key: string]: string };
  backgroundSync: boolean;
  syncConcurrency: number;

  importRunbooks: () => Promise<string[]>;
  refreshRunbooks: () => Promise<void>;
  deleteRunbookFromCache: (runbookId: string) => void;

  setSerialExecution: (id: string | null) => void;
  setCurrentRunbookId: (id: string | null, tag?: typeof SET_RUNBOOK_TAG) => void;
  selectTag: (runbookId: string, tag: string | null) => void;
  getLastTagForRunbook: (runbookId: string) => string | null;

  currentWorkspaceId: string;
  setCurrentWorkspaceId: (id: string) => void;

  setBackgroundSync: (backgroundSync: boolean) => void;
  setSyncConcurrency: (syncConcurrency: number) => void;
}

export const persistRunbookKeys: (keyof AtuinRunbookState)[] = [
  "currentRunbookId",
  "lastTagForRunbook",
  "currentWorkspaceId",
  "backgroundSync",
  "syncConcurrency",
];

export const createRunbookState: StateCreator<AtuinRunbookState> = (
  set,
  get,
  _store,
): AtuinRunbookState => ({
  runbooks: [],
  currentRunbookId: null,
  lastTagForRunbook: {},
  serialExecution: null,
  backgroundSync: false,
  syncConcurrency: 1,

  importRunbooks: async (): Promise<string[]> => {
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

    if (!filePath || filePath.length === 0) return [];

    return filePath;
  },

  // PERF: Yeah this won't work long term. Let's see how many runbooks people have in reality and optimize for 10x that
  refreshRunbooks: async () => {
    logger.debug("loading runbooks for WS", get().currentWorkspaceId);

    let runbooks = await Runbook.allFromWorkspace(get().currentWorkspaceId!);

    set({ runbooks });
  },

  deleteRunbookFromCache: (runbookId: string) => {
    const { runbooks, currentRunbookId } = get();
    const newRunbookId = currentRunbookId === runbookId ? null : currentRunbookId;
    const newRunbooks = runbooks.filter((rb) => rb.id !== runbookId);
    set({ runbooks: newRunbooks, currentRunbookId: newRunbookId });
  },

  setCurrentRunbookId: async (id: string | null, tag?: typeof SET_RUNBOOK_TAG) => {
    if (tag === SET_RUNBOOK_TAG) {
      set({ currentRunbookId: id });
    } else {
      throw new Error("calling setCurrentRunbookId directly is not supported; use RunbookContext");
    }
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

  currentWorkspaceId: "",

  setSerialExecution: (id: string | null) => {
    set({ serialExecution: id });
  },

  setCurrentWorkspaceId: (id: string) => {
    set({ currentWorkspaceId: id });
  },

  setBackgroundSync: (backgroundSync: boolean) => {
    set({ backgroundSync });
  },

  setSyncConcurrency: (syncConcurrency: number) => {
    set({ syncConcurrency });
  },
});
