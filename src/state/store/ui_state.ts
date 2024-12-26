import { StateCreator } from "zustand";

export interface AtuinUiState {
  online: boolean;
  connectedToHubSocket: boolean;
  searchOpen: boolean;
  proposedDesktopConnectUser: { username: string; token: string } | undefined;

  setOnline: (online: boolean) => void;
  setConnectedToHubSocket: (online: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  setProposedDesktopConnectuser: (proposedUser?: { username: string; token: string }) => void;
}

export const persistUiKeys: (keyof AtuinUiState)[] = [];

export const createUiState: StateCreator<AtuinUiState> = (set, _get, _store): AtuinUiState => ({
  online: false,
  connectedToHubSocket: false,
  searchOpen: false,
  proposedDesktopConnectUser: undefined,

  setOnline: (online: boolean) => set(() => ({ online })),
  setConnectedToHubSocket: (online: boolean) => set(() => ({ connectedToHubSocket: online })),
  setSearchOpen: (open) => set(() => ({ searchOpen: open })),
  setProposedDesktopConnectuser: (proposedUser?) =>
    set(() => ({ proposedDesktopConnectUser: proposedUser })),
});
