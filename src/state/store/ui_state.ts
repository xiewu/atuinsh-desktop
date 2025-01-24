import { StateCreator } from "zustand";

export interface AtuinUiState {
  online: boolean;
  focused: boolean;
  connectedToHubSocket: boolean;
  searchOpen: boolean;
  proposedDesktopConnectUser: { username: string; token: string } | undefined;
  isSyncing: boolean;
  colorMode: "light" | "dark";

  setOnline: (online: boolean) => void;
  setFocused: (focused: boolean) => void;
  setConnectedToHubSocket: (online: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  setProposedDesktopConnectuser: (proposedUser?: { username: string; token: string }) => void;
  setIsSyncing: (isSyncing: boolean) => void;
  setColorMode: (colorMode: "light" | "dark") => void;
}

export const persistUiKeys: (keyof AtuinUiState)[] = ["colorMode"];

export const createUiState: StateCreator<AtuinUiState> = (set, _get, _store): AtuinUiState => ({
  online: false,
  focused: false,
  connectedToHubSocket: false,
  searchOpen: false,
  proposedDesktopConnectUser: undefined,
  isSyncing: false,
  colorMode: "light",

  setOnline: (online: boolean) => set(() => ({ online })),
  setFocused: (focused: boolean) => set(() => ({ focused })),
  setConnectedToHubSocket: (online: boolean) => set(() => ({ connectedToHubSocket: online })),
  setSearchOpen: (open) => set(() => ({ searchOpen: open })),
  setProposedDesktopConnectuser: (proposedUser?) =>
    set(() => ({ proposedDesktopConnectUser: proposedUser })),
  setIsSyncing: (isSyncing: boolean) => set(() => ({ isSyncing })),
  setColorMode: (colorMode: "light" | "dark") => set(() => ({ colorMode })),
});
