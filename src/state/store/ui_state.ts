import { ColorMode, FunctionalColorMode } from "@/lib/color_modes";
import { StateCreator } from "zustand";

export interface AtuinUiState {
  online: boolean;
  focused: boolean;
  connectedToHubSocket: boolean;
  searchOpen: boolean;
  proposedDesktopConnectUser: { username: string; token: string } | undefined;
  isSyncing: boolean;
  colorMode: ColorMode;
  functionalColorMode: FunctionalColorMode;
  fontSize: number;
  fontFamily: string;

  setOnline: (online: boolean) => void;
  setFocused: (focused: boolean) => void;
  setConnectedToHubSocket: (online: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  setProposedDesktopConnectuser: (proposedUser?: { username: string; token: string }) => void;
  setIsSyncing: (isSyncing: boolean) => void;
  setColorMode: (colorMode: ColorMode) => void;
  setFunctionalColorMode: (colorMode: FunctionalColorMode) => void;
  setFontSize: (fontSize: number) => void;
  setFontFamily: (fontFamily: string) => void;
}

export const persistUiKeys: (keyof AtuinUiState)[] = ["colorMode", "fontSize", "fontFamily"];

export const createUiState: StateCreator<AtuinUiState> = (set, _get, _store): AtuinUiState => ({
  online: false,
  focused: false,
  connectedToHubSocket: false,
  searchOpen: false,
  proposedDesktopConnectUser: undefined,
  isSyncing: false,
  colorMode: "system",
  functionalColorMode: "light",
  fontSize: 16,
  fontFamily: "Inter",

  setOnline: (online: boolean) => set(() => ({ online })),
  setFocused: (focused: boolean) => set(() => ({ focused })),
  setConnectedToHubSocket: (online: boolean) => set(() => ({ connectedToHubSocket: online })),
  setSearchOpen: (open) => set(() => ({ searchOpen: open })),
  setProposedDesktopConnectuser: (proposedUser?) =>
    set(() => ({ proposedDesktopConnectUser: proposedUser })),
  setIsSyncing: (isSyncing: boolean) => set(() => ({ isSyncing })),
  setColorMode: (colorMode: ColorMode) => set(() => ({ colorMode })),
  setFunctionalColorMode: (colorMode: FunctionalColorMode) =>
    set(() => ({ functionalColorMode: colorMode })),
  setFontSize: (fontSize: number) => set(() => ({ fontSize })),
  setFontFamily: (fontFamily: string) => set(() => ({ fontFamily })),
});
