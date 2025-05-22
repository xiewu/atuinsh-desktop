import { useStore } from "@/state/store";
import { useMemo } from "react";
import * as themes from "@uiw/codemirror-themes-all";

export default function useCodemirrorTheme() {
  const colorMode = useStore((state) => state.functionalColorMode);
  const lightModeEditorTheme = useStore((state) => state.lightModeEditorTheme);
  const darkModeEditorTheme = useStore((state) => state.darkModeEditorTheme);

  const theme = useMemo(() => {
    return colorMode === "dark" ? darkModeEditorTheme : lightModeEditorTheme;
  }, [colorMode, lightModeEditorTheme, darkModeEditorTheme]);

  const themeObj = (themes as any)[theme];

  return themeObj;
}
