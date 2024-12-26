import { StateCreator } from "zustand";

export interface AtuinUiState {
  online: boolean;
  searchOpen: boolean;
  proposedDesktopConnectUser: { username: string; token: string } | undefined;

  setOnline: (online: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  setProposedDesktopConnectuser: (proposedUser?: { username: string; token: string }) => void;
}

export const persistUiKeys: (keyof AtuinUiState)[] = [];

export const createUiState: StateCreator<AtuinUiState> = (set, _get, _store): AtuinUiState => ({
  online: false,
  searchOpen: false,
  proposedDesktopConnectUser: undefined,

  setOnline: (online: boolean) => set(() => ({ online })),
  setSearchOpen: (open) => set(() => ({ searchOpen: open })),
  setProposedDesktopConnectuser: (proposedUser?) =>
    set(() => ({ proposedDesktopConnectUser: proposedUser })),
});
