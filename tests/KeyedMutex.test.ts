import { describe, it, expect } from 'vitest';
import { KeyedMutex } from '../src/infrastructure/KeyedMutex.js';

describe('KeyedMutex', () => {
  it('serializes work per key while parallelizing across keys', async () => {
    const mutex = new KeyedMutex();
    const insidePerKey = new Map<string, number>();
    const maxPerKey = new Map<string, number>();

    const worker = (key: string) =>
      mutex.runExclusive(key, async () => {
        insidePerKey.set(key, (insidePerKey.get(key) ?? 0) + 1);
        maxPerKey.set(key, Math.max(maxPerKey.get(key) ?? 0, insidePerKey.get(key)!));
        await new Promise((r) => setTimeout(r, 5));
        insidePerKey.set(key, insidePerKey.get(key)! - 1);
      });

    await Promise.all([
      ...Array.from({ length: 5 }, () => worker('a')),
      ...Array.from({ length: 5 }, () => worker('b')),
    ]);

    expect(maxPerKey.get('a')).toBe(1);
    expect(maxPerKey.get('b')).toBe(1);
  });

  it('garbage-collects idle key entries', async () => {
    const mutex = new KeyedMutex();
    await mutex.runExclusive('x', async () => {});
    await mutex.runExclusive('y', async () => {});
    expect(mutex.size()).toBe(0);
  });
});
