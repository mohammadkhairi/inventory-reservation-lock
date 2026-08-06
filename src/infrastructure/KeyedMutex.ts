import { AsyncMutex } from './AsyncMutex.js';

/**
 * Per-key mutex. Serializes work per `key` while allowing full parallelism across
 * distinct keys — the natural granularity for inventory (one lock per product).
 *
 * Idle mutexes are garbage-collected after their queue drains so the map does
 * not grow unbounded with the product catalogue.
 */
export class KeyedMutex {
  private readonly mutexes = new Map<string, { mutex: AsyncMutex; refCount: number }>();

  async runExclusive<T>(key: string, fn: () => Promise<T> | T): Promise<T> {
    const entry = this.acquire(key);
    try {
      return await entry.mutex.runExclusive(fn);
    } finally {
      this.release(key);
    }
  }

  /** Test-only: current number of live mutex entries. */
  size(): number {
    return this.mutexes.size;
  }

  private acquire(key: string): { mutex: AsyncMutex; refCount: number } {
    let entry = this.mutexes.get(key);
    if (!entry) {
      entry = { mutex: new AsyncMutex(), refCount: 0 };
      this.mutexes.set(key, entry);
    }
    entry.refCount += 1;
    return entry;
  }

  private release(key: string): void {
    const entry = this.mutexes.get(key);
    if (!entry) return;
    entry.refCount -= 1;
    if (entry.refCount <= 0) {
      this.mutexes.delete(key);
    }
  }
}
