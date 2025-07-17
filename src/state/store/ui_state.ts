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
  hiddenWorkspaces: Record<string, boolean>;
  sidebarWidth: number;
  sidebarOpen: boolean;
  sidebarClickStyle: "link" | "explorer";
  lastSidebarDragInfo: { itemIds: string[]; sourceWorkspaceId: string } | undefined;

  lightModeEditorTheme: string;
  darkModeEditorTheme: string;

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
  setLastSidebarDragInfo: (info?: { itemIds: string[]; sourceWorkspaceId: string }) => void;

  setLightModeEditorTheme: (theme: string) => void;
  setDarkModeEditorTheme: (theme: string) => void;

  getFolderState: (workspaceId: string) => Option<Record<string, boolean>>;
  toggleFolder: (workspaceId: string, folderId: string) => void;
  toggleWorkspaceVisibility: (workspaceId: string) => void;
  // updateFolderState: (workspaceId: string, state: Record<string, boolean>) => void;
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
  "lightModeEditorTheme",
  "darkModeEditorTheme",
  "hiddenWorkspaces",
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
  hiddenWorkspaces: {},
  sidebarWidth: 250,
  sidebarOpen: true,
  sidebarClickStyle: "link",
  lastSidebarDragInfo: undefined,

  lightModeEditorTheme: "githubLight",
  darkModeEditorTheme: "githubDark",

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
  setLastSidebarDragInfo: (info?: { itemIds: string[]; sourceWorkspaceId: string }) =>
    set(() => ({ lastSidebarDragInfo: info })),

  setLightModeEditorTheme: (theme: string) => set(() => ({ lightModeEditorTheme: theme })),
  setDarkModeEditorTheme: (theme: string) => set(() => ({ darkModeEditorTheme: theme })),

  getFolderState: (workspaceId: string) => Some(get().folderState[workspaceId]),
  toggleFolder: (workspaceId: string, folderId: string) => {
    set((state) => {
      const currentState = state.folderState[workspaceId] || {};
      if (currentState[folderId] === undefined) {
        currentState[folderId] = false;
      } else {
        currentState[folderId] = !currentState[folderId];
      }
      return { folderState: { ...state.folderState, [workspaceId]: currentState } };
    });
  },
  toggleWorkspaceVisibility: (workspaceId: string) => {
    set((state) => {
      if (state.hiddenWorkspaces[workspaceId]) {
        delete state.hiddenWorkspaces[workspaceId];
      } else {
        state.hiddenWorkspaces[workspaceId] = true;
      }
      return state;
    });
  },
  // updateFolderState: (workspaceId: string, state: Record<string, boolean>) => {
  //   const currentState = get().folderState[workspaceId] || {};
  //   for (const [folderId, isOpen] of Object.entries(state)) {
  //     currentState[folderId] = isOpen;
  //   }
  //   set(() => ({ folderState: { ...get().folderState, [workspaceId]: currentState } }));
  // },
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
