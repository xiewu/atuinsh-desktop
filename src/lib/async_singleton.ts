import { None, Option, Some } from "@binarymuse/ts-stdlib";

type UnwrappedPromise<T> = {
  resolve: (value: T) => void;
  reject: (reason?: any) => void;
  promise: Promise<T>;
};

function createUnwrappedPromise<T>(): UnwrappedPromise<T> {
  let resolve: (value: T) => void;
  let reject: (reason?: any) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {
    resolve: resolve!,
    reject: reject!,
    promise,
  };
}

/**
 * A singleton that ensures a function is only run once at a time.
 *
 * By calling `run`, you request that the function be run. If the
 * function is already running, the request will be queued and
 * the function will be called immediately after the previous
 * invocation completes. If the function is running and a queued
 * run already exists, the promise for the existing queued run
 * will be returned, and the function will be called only once
 * after the previous invocation completes.
 */
export default class AsyncSingleton<T> {
  private running = false;
  private queued: Option<UnwrappedPromise<T>> = None;

  constructor(private readonly fn: () => T) {}

  /**
   * Requests to run the function wrapped by this instance. If the
   * function is already running, the request will be queued and
   * the function will be called immediately after the previous
   * invocation completes. If the function is running and a queued
   * run already exists, the promise for the existing queued run
   * will be returned.
   *
   * @returns A promise that resolves when the function has completed
   * the requested run.
   */
  async run(): Promise<T> {
    if (this.running && this.queued.isSome()) {
      return this.queued.unwrap().promise;
    } else if (this.running) {
      const unwrappedPromise = createUnwrappedPromise<T>();
      this.queued = Some(unwrappedPromise);
      return unwrappedPromise.promise;
    } else {
      this.running = true;
      let unwrappedPromise: UnwrappedPromise<T>;

      if (this.queued.isSome()) {
        unwrappedPromise = this.queued.unwrap();
        this.queued = None;
      } else {
        unwrappedPromise = createUnwrappedPromise<T>();
      }

      this.doRun(unwrappedPromise.resolve, unwrappedPromise.reject);
      unwrappedPromise.promise.finally(() => {
        this.running = false;
        if (this.queued.isSome()) {
          this.run();
        }
      });
      return unwrappedPromise.promise;
    }
  }

  private async doRun(resolve: (value: T) => void, reject: (reason?: any) => void) {
    try {
      const res = await Promise.resolve(this.fn());
      resolve(res);
    } catch (e) {
      reject(e);
    }
  }
}

if (import.meta.vitest) {
  const { test, expect, vi } = import.meta.vitest;

  test("AsyncSingleton", async () => {
    vi.useFakeTimers();

    let runs = 0;
    const singleton = new AsyncSingleton(() => {
      return new Promise((resolve) => {
        setTimeout(() => {
          runs++;
          resolve(`Hello ${runs}`);
        }, 100);
      });
    });

    const res1 = singleton.run();
    expect(runs).toBe(0);
    // Since the function is already running, both these calls
    // will return the same queued promise.
    const res2 = singleton.run();
    const res3 = singleton.run();
    expect(res1).toStrictEqual(res2);

    vi.advanceTimersByTime(100);
    expect(runs).toBe(1);
    await expect(res1).resolves.toBe("Hello 1");

    vi.advanceTimersByTime(100);
    expect(runs).toBe(2);
    await expect(res2).resolves.toBe("Hello 2");
    await expect(res3).resolves.toBe("Hello 2");

    vi.runAllTimers();
    expect(runs).toBe(2);
  });
}
