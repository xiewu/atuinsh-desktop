import Runbook from "../runbooks/runbook";
import { open } from "@tauri-apps/plugin-dialog";
import track_event from "@/tracking";
import Logger from "@/lib/logger";
const logger = new Logger("RunbookStore", "purple", "pink");

import { StateCreator } from "zustand";

export interface AtuinRunbookState {
  runbooks: Runbook[];

  // The ID of the runbook that is currently being executed
  // Right now we do not support concurrent or background runbook execution
  serialExecution: string | null;
  currentRunbookId: string | null;
  lastTagForRunbook: { [key: string]: string };

  importRunbook: () => Promise<Runbook[] | null>;
  refreshRunbooks: () => Promise<void>;
  deleteRunbookFromCache: (runbookId: string) => void;

  setSerialExecution: (id: string | null) => void;
  setCurrentRunbookId: (id: string | null) => void;
  selectTag: (runbookId: string, tag: string | null) => void;
  getLastTagForRunbook: (runbookId: string) => string | null;

  currentWorkspaceId: string;
  setCurrentWorkspaceId: (id: string) => void;
}

export const persistRunbookKeys: (keyof AtuinRunbookState)[] = [
  "currentRunbookId",
  "lastTagForRunbook",
  "currentWorkspaceId",
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

    const { currentWorkspaceId } = get();
    let runbooks = await Promise.all(
      filePath.map(async (file) => {
        return await Runbook.importFile(file, currentWorkspaceId);
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
    logger.debug("loading runbooks for WS", get().currentWorkspaceId);

    let runbooks = await Runbook.all(get().currentWorkspaceId!);

    set({ runbooks });
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

  currentWorkspaceId: "",

  setSerialExecution: (id: string | null) => {
    set({ serialExecution: id });
  },

  setCurrentWorkspaceId: (id: string) => {
    const lastWorkspaceId = get().currentWorkspaceId;
    let runbookId = get().currentRunbookId;
    if (id !== lastWorkspaceId) {
      runbookId = null;
    }
    set({ currentWorkspaceId: id, currentRunbookId: runbookId });
  },
});
