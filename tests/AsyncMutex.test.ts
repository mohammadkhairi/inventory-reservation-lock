import { describe, it, expect } from 'vitest';
import { AsyncMutex } from '../src/infrastructure/AsyncMutex.js';

describe('AsyncMutex', () => {
  it('serializes concurrent critical sections', async () => {
    const mutex = new AsyncMutex();
    let inside = 0;
    let observedMax = 0;

    const worker = () =>
      mutex.runExclusive(async () => {
        inside += 1;
        observedMax = Math.max(observedMax, inside);
        await new Promise((r) => setTimeout(r, 5));
        inside -= 1;
      });

    await Promise.all(Array.from({ length: 20 }, worker));

    expect(observedMax).toBe(1);
    expect(inside).toBe(0);
  });

  it('preserves FIFO ordering', async () => {
    const mutex = new AsyncMutex();
    const order: number[] = [];

    const promises = Array.from({ length: 10 }, (_, i) =>
      mutex.runExclusive(async () => {
        order.push(i);
      }),
    );
    await Promise.all(promises);
    expect(order).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('releases the lock even when the critical section throws', async () => {
    const mutex = new AsyncMutex();
    await expect(
      mutex.runExclusive(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    // Next caller must still acquire the lock.
    const result = await mutex.runExclusive(async () => 'ok');
    expect(result).toBe('ok');
  });
});
