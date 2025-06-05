type OperatingSystem = "macos" | "windows" | "linux" | "testenv";

type GlobalOptions = {
  os: OperatingSystem;
  customTitleBar: boolean;
  devPrefix: string;
  noSync: boolean;
};

export function getGlobalOptions(): GlobalOptions {
  // If we're running a test, we don't have the window object
  if (typeof window === "undefined") {
    return {
      os: "testenv",
      customTitleBar: true,
      devPrefix: "dev",
      noSync: true,
    };
  }

  const params = new URLSearchParams(window.location.search);

  return {
    os: params.get("os") as OperatingSystem,
    customTitleBar: params.get("os") === "macos",
    devPrefix: params.get("devPrefix") || "dev",
    noSync: params.get("noSync") === "true",
  } as const;
}
