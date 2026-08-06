import { describe, it, expect } from 'vitest';
import { makeHarness } from './helpers.js';
import { InsufficientStockError } from '../src/domain/errors.js';
import { ReservationState } from '../src/domain/ReservationState.js';

describe('Level 3 — concurrency', () => {
  it('the canonical flash-sale scenario: stock=1, 500 concurrent reservations → exactly 1 success', async () => {
    const h = await makeHarness();
    await h.seedProduct('flash-sku', 1);

    const attempts = Array.from({ length: 500 }, (_, i) =>
      h.service
        .reserve({ productId: 'flash-sku', userId: `user-${i}`, quantity: 1 })
        .then(() => ({ ok: true as const }))
        .catch((err: unknown) => ({ ok: false as const, err })),
    );

    const results = await Promise.all(attempts);
    const successes = results.filter((r) => r.ok);
    const failures = results.filter((r): r is { ok: false; err: unknown } => !r.ok);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(499);
    expect(failures.every((f) => f.err instanceof InsufficientStockError)).toBe(true);

    const snapshot = await h.service.getAvailability('flash-sku');
    expect(snapshot.availableStock).toBe(0);
    expect(snapshot.activeReservations).toBe(1);
  });

  it('N successes for stock=N under heavy concurrency', async () => {
    const h = await makeHarness();
    const stock = 25;
    const requests = 500;
    await h.seedProduct('bulk-sku', stock);

    const attempts = Array.from({ length: requests }, (_, i) =>
      h.service
        .reserve({ productId: 'bulk-sku', userId: `user-${i}`, quantity: 1 })
        .then(() => true)
        .catch(() => false),
    );
    const results = await Promise.all(attempts);
    const successes = results.filter(Boolean).length;

    expect(successes).toBe(stock);
    expect((await h.service.getAvailability('bulk-sku')).availableStock).toBe(0);
  });

  it('parallelizes across products (no head-of-line blocking)', async () => {
    const h = await makeHarness();
    for (let i = 0; i < 10; i += 1) {
      await h.seedProduct(`sku-${i}`, 1);
    }

    const attempts = Array.from({ length: 10 }, (_, i) =>
      h.service.reserve({ productId: `sku-${i}`, userId: `user-${i}`, quantity: 1 }),
    );
    const reservations = await Promise.all(attempts);
    expect(reservations).toHaveLength(10);
    expect(reservations.every((r) => r.state === ReservationState.ACTIVE)).toBe(true);
  });

  it('mixed reserve/confirm/cancel bursts never oversell', async () => {
    const h = await makeHarness();
    await h.seedProduct('sku', 10);

    // 100 reserves interleaved with confirm/cancel of prior reservations.
    const reserved: string[] = [];
    const ops: Array<Promise<unknown>> = [];
    for (let i = 0; i < 100; i += 1) {
      ops.push(
        h.service
          .reserve({ productId: 'sku', userId: `u-${i}`, quantity: 1 })
          .then((r) => reserved.push(r.id))
          .catch(() => undefined),
      );
    }
    await Promise.all(ops);

    // Randomly confirm ~half of the successful reservations, cancel the rest.
    const decisions = reserved.map((id, idx) =>
      idx % 2 === 0 ? h.service.confirm(id).catch(() => undefined) : h.service.cancel(id).catch(() => undefined),
    );
    await Promise.all(decisions);

    const snapshot = await h.service.getAvailability('sku');
    expect(snapshot.confirmedSales + snapshot.activeReservations).toBeLessThanOrEqual(
      snapshot.totalStock,
    );
    expect(snapshot.availableStock).toBeGreaterThanOrEqual(0);
  });
});
