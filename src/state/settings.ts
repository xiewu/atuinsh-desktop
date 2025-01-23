import { KVStore } from "./kv";

const PROMETHEUS_URL_KEY = "settings.runbooks.prometheus_url";
const TERMINAL_FONT = "settings.runbooks.terminal.font";
const TERMINAL_FONT_SIZE = "settings.runbooks.terminal.font_size";
const TERMINAL_GL = "settings.runbooks.terminal.gl";

export class Settings {
  public static DEFAULT_FONT = "Fira Code";
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
}
