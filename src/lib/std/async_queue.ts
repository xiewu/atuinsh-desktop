import { Deque } from "@binarymuse/ts-stdlib";

type ResolveFn = () => any;
export type ReleaseFn = () => void;

/**
 * A queue that executes functions asynchronously, respecting a concurrency limit and priority.
 *
 * `checkout()` returns a release function that must be called exactly once when done with the resource.
 *
 * ## Example
 *
 * ```ts
 * const queue = new AsyncQueue(2);
 *
 * // resolves immediately with a release function
 * const release1 = await queue.checkout();
 * // resolves immediately with a release function
 * const release2 = await queue.checkout();
 * // resolves once a resource is released, with its own release function
 * const release3 = await queue.checkout();
 * // release the resource
 * release1();
 * ```
 */
export default class AsyncQueue {
  private concurrency: number;
  private runningCount: number = 0;
  private queues: Map<number, Deque<ResolveFn>> = new Map();

  constructor(concurrency: number) {
    this.concurrency = concurrency;
  }

  /**
   * Checkout a resource from the queue. If the queue is at the concurrency limit, the promise will resolve
   * when the resource is available.
   *
   * @param priority - The priority of the resource. Higher priority is executed first; 0 is lowest priority.
   * @returns A promise that resolves with a function to release the resource when done.
   */
  public async checkout(priority: number = 0): Promise<ReleaseFn> {
    if (this.runningCount < this.concurrency) {
      this.runningCount++;
      return () => this.release();
    }

    return new Promise<ReleaseFn>((resolve) => {
      let queue = this.queues.get(priority);
      if (!queue) {
        queue = new Deque();
        this.queues.set(priority, queue);
      }

      queue.pushBack(() => {
        this.runningCount++;
        let alreadyReleased = false;
        resolve(() => {
          if (alreadyReleased) {
            throw new Error("Cannot release: already released");
          }
          alreadyReleased = true;
          this.release();
        });
      });
    });
  }

  private async release() {
    if (this.runningCount <= 0) {
      throw new Error("Cannot release: no resources are checked out");
    }

    this.runningCount--;

    const priorities = Array.from(this.queues.keys()).sort((a, b) => b - a);
    for (const priority of priorities) {
      const queue = this.queues.get(priority);
      if (!queue || queue.peekFront().isNone()) {
        this.queues.delete(priority);
        continue;
      }

      const next = queue.popFront();
      if (next.isSome()) {
        const fn = next.unwrap();
        fn();
        return;
      }
    }
  }
}

if (import.meta.vitest) {
  const { test, expect, vi } = import.meta.vitest;

  test("AsyncQueue respects concurrency limit", async () => {
    const queue = new AsyncQueue(2);
    const results: number[] = [];

    const release1 = await queue.checkout();
    results.push(1);
    const release2 = await queue.checkout();
    results.push(2);

    queue.checkout().then((release3) => {
      results.push(3);
      return release3;
    });

    queue.checkout().then((release4) => {
      results.push(4);
      return release4;
    });

    expect(results).toEqual([1, 2]);

    release1();

    await vi.waitFor(() => expect(results).toEqual([1, 2, 3]));

    release2();

    await vi.waitFor(() => expect(results).toEqual([1, 2, 3, 4]));
  });

  test("AsyncQueue handles release errors", async () => {
    const queue = new AsyncQueue(1);
    const release = await queue.checkout();

    release();
    await expect(release()).rejects.toThrow("Cannot release: no resources are checked out");
  });

  test("AsyncQueue processes queue in order", async () => {
    const queue = new AsyncQueue(1);
    const order: string[] = [];

    const release1 = await queue.checkout();

    const release2 = queue.checkout().then((release2) => {
      order.push("first");
      return release2;
    });

    const release3 = queue.checkout().then((release3) => {
      order.push("second");
      return release3;
    });

    const release4 = queue.checkout().then((release4) => {
      order.push("third");
      return release4;
    });

    release1();

    (await release2)();
    await vi.waitFor(() => expect(order).toEqual(["first"]));

    (await release3)();
    await vi.waitFor(() => expect(order).toEqual(["first", "second"]));

    (await release4)();
    await vi.waitFor(() => expect(order).toEqual(["first", "second", "third"]));
  });

  test("AsyncQueue respects priority order", async () => {
    const queue = new AsyncQueue(1);
    const order: string[] = [];

    const release1 = await queue.checkout();
    order.push("first");

    const release2 = queue.checkout(0).then((release2) => {
      order.push("lowest");
      return release2;
    });

    const release3 = queue.checkout(2).then((release3) => {
      order.push("highest");
      return release3;
    });

    const release4 = queue.checkout(1).then((release4) => {
      order.push("medium");
      return release4;
    });

    expect(order).toEqual(["first"]);

    release1();
    await vi.waitFor(() => expect(order).toEqual(["first", "highest"]));

    (await release3)();
    await vi.waitFor(() => expect(order).toEqual(["first", "highest", "medium"]));

    (await release4)();
    await vi.waitFor(() => expect(order).toEqual(["first", "highest", "medium", "lowest"]));

    (await release2)();
  });
}
