import { useEffect, useState } from "react";
import { SharedStateManager } from "./manager";
import { AtuinSharedStateAdapter } from "./adapter";
import { SharableState } from "./types";

async function defaultUpdateOptimistic<T>(_data: T): Promise<string> {
  throw new Error("Shared state is not ready");
}

/**
 * Use a shared state document.
 *
 * To apply optimistic updates, pass a function to `updateOptimistic` that synchronously
 * applies an update to the data. The function will be called with the current state.
 * The call to `updateOptimistic` will return a promise to the change reference for the update.
 *
 * ```
 * const [data, updateOptimistic] = useSharedState("state-id");
 *
 * const changeRef = await updateOptimistic((data) => {
 *   data.foo = "bar";
 * });
 * ```
 *
 * For more information see {@link SharedStateManager}.
 *
 * @param T - The type of the shared state document; must be a JSON-serializable object (not an array).
 * @param stateId - The ID of the shared state document.
 * @returns A tuple containing the current state and a function for optimistically updating the state.
 */
export default function useSharedState<T extends SharableState>(
  stateId: string,
): [T, (callback: (data: T) => void) => Promise<string>] {
  const [data, setData] = useState<T>({} as T);
  const [manager, setManager] = useState<SharedStateManager<T> | null>(null);

  useEffect(() => {
    const manager = new SharedStateManager<T>(stateId, new AtuinSharedStateAdapter<T>(stateId));
    const unsub = manager.subscribe(setData);

    setManager(manager);

    return () => {
      unsub();
      manager.destroy();
    };
  }, [stateId]);

  return [data, manager?.updateOptimistic || defaultUpdateOptimistic];
}
