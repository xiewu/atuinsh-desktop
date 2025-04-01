import { StateCreator } from "zustand";

export type DialogAction<T> = {
  label: string;
  variant?: "flat" | "light" | "shadow" | "solid" | "bordered" | "faded" | "ghost";
  color?: "default" | "primary" | "secondary" | "success" | "warning" | "danger";
  confirmWith?: string;
  value: T;
};

export type DialogRequest<T> = {
  id: string;
  icon?: "info" | "warning" | "error" | "success" | "question";
  title: string;
  message: React.ReactNode;
  actions: DialogAction<T>[];
  resolve: (value: T) => void;
};

export interface AtuinDialogState {
  dialogQueue: DialogRequest<any>[];

  addDialog: (request: DialogRequest<any>) => void;
  popDialog: () => void;
}

export const persistDialogKeys: (keyof AtuinDialogState)[] = [];

export const createDialogState: StateCreator<AtuinDialogState> = (set, _get, _store) => ({
  dialogQueue: [],

  addDialog: (request: DialogRequest<any>) => {
    set((state) => ({
      dialogQueue: [...state.dialogQueue, request],
    }));
  },
  popDialog: () => {
    set((state) => ({
      dialogQueue: state.dialogQueue.slice(1),
    }));
  },
});
