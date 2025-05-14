import { KVStore } from "./kv";

const PROMETHEUS_URL_KEY = "settings.runbooks.prometheus_url";
const TERMINAL_FONT = "settings.runbooks.terminal.font";
const TERMINAL_FONT_SIZE = "settings.runbooks.terminal.font_size";
const TERMINAL_GL = "settings.runbooks.terminal.gl";
const TERMINAL_SHELL = "settings.runbooks.terminal.shell";
const SCRIPT_INTERPRETERS = "settings.runbooks.script.interpreters";

export class Settings {
  public static DEFAULT_FONT = "FiraCode";
  public static DEFAULT_FONT_SIZE = 14;

  public static async runbookPrometheusUrl(val: string | null = null): Promise<string> {
    let store = await KVStore.open_default();

    if (val || val === "") {
      await store.set(PROMETHEUS_URL_KEY, val);
      return val;
    }

    return (await store.get(PROMETHEUS_URL_KEY)) || "";
  }

  public static async terminalFont(val: string | null = null): Promise<string | null> {
    let store = await KVStore.open_default();

    if (val || val === "") {
      await store.set(TERMINAL_FONT, val);
      return val;
    }

    return await store.get(TERMINAL_FONT);
  }

  public static async terminalFontSize(val: number | null = null): Promise<number | null> {
    let store = await KVStore.open_default();

    if (val !== null) {
      await store.set(TERMINAL_FONT_SIZE, val);
      return val;
    }

    return await store.get(TERMINAL_FONT_SIZE);
  }

  public static async terminalGL(val: boolean | null = null): Promise<boolean> {
    let store = await KVStore.open_default();

    if (val !== null) {
      await store.set(TERMINAL_GL, val);
      return val;
    }

    return (await store.get(TERMINAL_GL)) || false;
  }

  public static async terminalShell(val: string | null = null): Promise<string | null> {
    let store = await KVStore.open_default();

    if (val || val === "") {
      await store.set(TERMINAL_SHELL, val);
      return val;
    }

    return await store.get(TERMINAL_SHELL);
  }

  public static async scriptInterpreters(): Promise<Array<{command: string; name: string}>> {
    let store = await KVStore.open_default();
    const interpreters = await store.get<Array<{command: string; name: string}>>(SCRIPT_INTERPRETERS);
    return interpreters || [];
  }

  public static async setScriptInterpreters(interpreters: Array<{command: string; name: string}>): Promise<void> {
    let store = await KVStore.open_default();
    await store.set(SCRIPT_INTERPRETERS, interpreters);
  }
}
