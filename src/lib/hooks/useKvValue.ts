import { KVStore } from "@/state/kv";
import { useEffect, useState } from "react";

/**
 * A hook that fetches a value from the KV store and updates it when it changes.
 *
 * @param key The key to fetch the value from.
 * @param defaultValue The default value to use if the value is not found.
 * @returns A tuple containing the current value and a function to update the value.
 */
export function useKvValue<T>(key: string, defaultValue: T): [T, (value: T) => Promise<void>] {
  const [value, setValue] = useState<T>(defaultValue);

  const updateValue = async (value: T) => {
    setValue(value);
    const db = await KVStore.open_default();
    await db.set(key, value);
  };

  useEffect(() => {
    (async () => {
      const db = await KVStore.open_default();
      const value = await db.get<T>(key);
      if (value) {
        setValue(value);
      }
    })();
  }, [key]);

  return [value, updateValue];
}
