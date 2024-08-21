import { KVStore } from "./kv";

const PROMETHEUS_URL_KEY = "settings.runbooks.prometheus_url";

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
}
