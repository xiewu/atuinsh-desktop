import Emittery from "emittery";

type UnlockFn = () => void;

/**
 * A generic mutex based on Promises.
 *
 * @emits `"free"` - When the mutex is unlocked and no other consumers are waiting
 */
export default class Mutex extends Emittery {
  currentLock: Promise<void> | null = null;

  constructor() {
    super();
  }

  /**
   * Acquires the lock. If the lock is already held, waits for the lock to be released.
   *
   * @returns a function that releases the lock
   */
  public async lock(): Promise<UnlockFn> {
    const waitForPrevious = this.currentLock;

    let _resolve: UnlockFn;
    const newLock = new Promise<void>((resolve) => {
      _resolve = () => {
        resolve();

        if (this.currentLock === newLock) {
          this.currentLock = null;
          this.emit("free");
        }
      };
    });

    this.currentLock = newLock;

    if (waitForPrevious) {
      await waitForPrevious;
    }

    return _resolve!;
  }

  /**
   * A convenience method to acquire a lock, run a function, and then release the lock.
   *
   * @returns a promise resolving to the return value of the passed function
   */
  public async runExclusive<T>(fn: () => Promise<T> | T): Promise<T> {
    const unlock = await this.lock();
    try {
      return await fn();
    } finally {
      unlock();
    }
  }
}
