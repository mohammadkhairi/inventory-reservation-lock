/**
 * Fair FIFO async mutex. Only one caller runs inside `runExclusive` at a time.
 *
 * Node.js is single-threaded, but async operations interleave freely at every
 * `await` point. Read-modify-write sequences on shared state therefore race
 * unless we explicitly serialize them. This mutex chains critical sections on a
 * single promise so the runtime can only enter one section at a time per key.
 */
export class AsyncMutex {
  private tail: Promise<void> = Promise.resolve();

  async runExclusive<T>(fn: () => Promise<T> | T): Promise<T> {
    const previous = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  }
}
