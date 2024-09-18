import { KVStore } from "./kv";

const PROMETHEUS_URL_KEY = "settings.runbooks.prometheus_url";
const TERMINAL_FONT = "settings.runbooks.terminal.font";
const TERMINAL_GL = "settings.runbooks.terminal.gl";

export class Settings {
  public static async runbookPrometheusUrl(
    val: string | null = null,
  ): Promise<string> {
    let store = await KVStore.open_default();

    if (val) {
      await store.set(PROMETHEUS_URL_KEY, val);
      return val;
    }

    return await store.get(PROMETHEUS_URL_KEY);
  }

  public static async terminalFont(val: string | null = null): Promise<string> {
    let store = await KVStore.open_default();

    if (val) {
      await store.set(TERMINAL_FONT, val);
      return val;
    }

    return await store.get(TERMINAL_FONT);
  }

  public static async terminalGL(val: boolean | null = null): Promise<boolean> {
    console.log(val);
    let store = await KVStore.open_default();

    if (val !== null) {
      await store.set(TERMINAL_GL, val);
      return val;
    }

    return await store.get(TERMINAL_GL);
  }
}
