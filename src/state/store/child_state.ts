import { StateCreator } from "zustand";

export interface AtuinChildState {
    // Map of runbook id to block ID to child process ID
    childProcesses: Map<string, Map<string, string>>;
}

export const persistChildKeys: (keyof AtuinChildState)[] = [];

export const createChildState: StateCreator<AtuinChildState> = (_set, _get, _store): AtuinChildState => ({
    childProcesses: new Map(),
});
