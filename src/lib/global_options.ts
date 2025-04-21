type OperatingSystem = "macos" | "windows" | "linux";

type GlobalOptions = {
  os: OperatingSystem;
  customTitleBar: boolean;
  devPrefix: string;
  noSync: boolean;
};

export function getGlobalOptions(): GlobalOptions {
  const params = new URLSearchParams(window.location.search);

  return {
    os: params.get("os") as OperatingSystem,
    customTitleBar: params.get("os") === "macos",
    devPrefix: params.get("devPrefix") || "dev",
    noSync: params.get("noSync") === "true",
  } as const;
}
