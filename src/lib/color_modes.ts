import { event } from "@tauri-apps/api";
import { AtuinStore } from "@/state/store";
import { getCurrentWindow } from "@tauri-apps/api/window";

export type ColorMode = "light" | "dark" | "system";
export type FunctionalColorMode = "light" | "dark";

export function setupColorModes(store: AtuinStore) {
  function setFunctionalColorMode(mode: "light" | "dark") {
    store.getState().setFunctionalColorMode(mode);
  }

  store.subscribe(
    (state) => state.colorMode,
    async (colorMode) => {
      if (colorMode === "dark") {
        setFunctionalColorMode("dark");
      } else if (colorMode === "light") {
        setFunctionalColorMode("light");
      } else if (colorMode === "system") {
        const systemTheme = await getCurrentWindow().theme();
        if (systemTheme === "light") {
          setFunctionalColorMode("light");
        } else {
          setFunctionalColorMode("dark");
        }
      }
    },
    {
      fireImmediately: true,
    },
  );

  store.subscribe(
    (state) => state.functionalColorMode,
    (functionalColorMode) => {
      document.documentElement.classList.remove("light", "dark");
      document.documentElement.classList.add(functionalColorMode);
    },
    {
      fireImmediately: true,
    },
  );

  event.listen("tauri://theme-changed", ({ payload }) => {
    const { colorMode } = store.getState();
    if (colorMode === "system") {
      setFunctionalColorMode(payload as "light" | "dark");
    }
  });
}
