import debounce from "lodash.debounce";
import { useEffect, useMemo, useState } from "react";

type AnyFn = (...args: any) => any;
type Fn<T extends AnyFn> = (...args: Parameters<T>) => ReturnType<T> | undefined;
type WrapperFn<T extends AnyFn> = Fn<T> & { flush: () => void };

export default function useDebouncedFunction<T extends AnyFn>(fn: T, delay: number): WrapperFn<T> {
  const debounced = useMemo(() => {
    return debounce(fn, delay);
  }, [fn, delay]);

  const [debouncedFn, setDebouncedFn] = useState<WrapperFn<T>>(debounced);

  useEffect(() => {
    // Must use function to avoid treating `debounced` as a state setter function
    setDebouncedFn(() => debounced);

    return () => {
      debounced.flush();
    };
  }, [debounced]);

  return debouncedFn;
}
