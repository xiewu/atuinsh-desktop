import { ColorMode, FunctionalColorMode } from "@/lib/color_modes";
import { Update } from "@tauri-apps/plugin-updater";
import { StateCreator } from "zustand";
import { Option, Some } from "@binarymuse/ts-stdlib";

export interface AtuinUiState {
  focused: boolean;
  connectedToHubSocket: boolean;
  searchOpen: boolean;
  proposedDesktopConnectUser: { username: string; token: string } | undefined;
  isSyncing: boolean;
  colorMode: ColorMode;
  functionalColorMode: FunctionalColorMode;
  fontSize: number;
  fontFamily: string;
  availableUpdate: Update | undefined;
  updating: boolean;
  showedUpdatePrompt: boolean;
  // Consumed by React Arborist;
  // { [workspaceId]: { [folderId]: isOpen }}
  folderState: Record<string, Record<string, boolean>>;
  sidebarWidth: number;
  sidebarOpen: boolean;
  sidebarClickStyle: "link" | "explorer";

  setFocused: (focused: boolean) => void;
  setConnectedToHubSocket: (online: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  setProposedDesktopConnectuser: (proposedUser?: { username: string; token: string }) => void;
  setIsSyncing: (isSyncing: boolean) => void;
  setColorMode: (colorMode: ColorMode) => void;
  setFunctionalColorMode: (colorMode: FunctionalColorMode) => void;
  setFontSize: (fontSize: number) => void;
  setFontFamily: (fontFamily: string) => void;
  setAvailableUpdate: (update: Update | undefined) => void;
  setUpdating: (updating: boolean) => void;
  setShowedUpdatePrompt: (showed: boolean) => void;
  setSidebarWidth: (width: number) => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarClickStyle: (style: "link" | "explorer") => void;

  getFolderState: (workspaceId: string) => Option<Record<string, boolean>>;
  updateFolderState: (workspaceId: string, state: Record<string, boolean>) => void;
  deleteWorkspaceFolderState: (workspaceId: string) => void;
  deleteFolderState: (workspaceId: string, folderId: string) => void;
}

export const persistUiKeys: (keyof AtuinUiState)[] = [
  "colorMode",
  "fontSize",
  "fontFamily",
  "folderState",
  "sidebarWidth",
  "sidebarOpen",
  "sidebarClickStyle",
];

export const createUiState: StateCreator<AtuinUiState> = (set, get, _store): AtuinUiState => ({
  focused: false,
  connectedToHubSocket: false,
  searchOpen: false,
  proposedDesktopConnectUser: undefined,
  isSyncing: false,
  colorMode: "system",
  functionalColorMode: "light",
  fontSize: 16,
  fontFamily: "Inter",
  availableUpdate: undefined,
  updating: false,
  showedUpdatePrompt: false,
  folderState: {},
  sidebarWidth: 250,
  sidebarOpen: true,
  sidebarClickStyle: "link",
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
  setAvailableUpdate: (update: Update | undefined) => set(() => ({ availableUpdate: update })),
  setUpdating: (updating: boolean) => set(() => ({ updating })),
  setShowedUpdatePrompt: (showed: boolean) => set(() => ({ showedUpdatePrompt: showed })),
  setSidebarWidth: (width: number) => set(() => ({ sidebarWidth: width })),
  setSidebarOpen: (open: boolean) => set(() => ({ sidebarOpen: open })),
  setSidebarClickStyle: (style: "link" | "explorer") => set(() => ({ sidebarClickStyle: style })),

  getFolderState: (workspaceId: string) => Some(get().folderState[workspaceId]),
  updateFolderState: (workspaceId: string, state: Record<string, boolean>) => {
    const currentState = get().folderState[workspaceId] || {};
    for (const [folderId, isOpen] of Object.entries(state)) {
      currentState[folderId] = isOpen;
    }
    set(() => ({ folderState: { ...get().folderState, [workspaceId]: currentState } }));
  },
  deleteWorkspaceFolderState: (workspaceId: string) => {
    const currentState = get().folderState;
    delete currentState[workspaceId];
    set(() => ({ folderState: currentState }));
  },
  deleteFolderState: (workspaceId: string, folderId: string) => {
    const currentState = get().folderState;
    const workspaceState = currentState[workspaceId];
    delete workspaceState[folderId];
    set(() => ({ folderState: { ...currentState, [workspaceId]: workspaceState } }));
  },
});
