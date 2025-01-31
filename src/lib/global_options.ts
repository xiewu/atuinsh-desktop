type OperatingSystem = "macos" | "windows" | "linux";

type GlobalOptions = {
  os: OperatingSystem;
  customTitleBar: boolean;
};

export function getGlobalOptions(): GlobalOptions {
  const params = new URLSearchParams(window.location.search);

  return {
    os: params.get("os") as OperatingSystem,
    customTitleBar: params.get("os") === "macos",
  } as const;
}
