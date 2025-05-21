import { timeoutPromise } from "./utils";

export default class Backoff {
  private static readonly MAX_DELAY = 10000;
  private static readonly INITIAL_DELAY = 1000;
  private static readonly MULTIPLIER = 2;

  private attempts = 0;
  private delay = Backoff.INITIAL_DELAY;

  constructor() {}

  public async next(): Promise<void> {
    this.attempts++;
    this.delay = Math.min(this.delay * Backoff.MULTIPLIER, Backoff.MAX_DELAY);
    await timeoutPromise(this.delay, "backoff");
  }

  public reset() {
    this.attempts = 0;
    this.delay = Backoff.INITIAL_DELAY;
  }
}
