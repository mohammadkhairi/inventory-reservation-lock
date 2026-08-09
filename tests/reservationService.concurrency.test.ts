import { beforeEach, describe, it, expect } from 'vitest';
import { seedProduct, truncateAll } from './helpers.js';
import { InsufficientStockError } from '../src/errors.js';
import * as productService from '../src/services/productService.js';
import * as reservationService from '../src/services/reservationService.js';
import { ReservationState } from '../src/db/schema/enums.js';

describe('reservationService — concurrency', () => {
  beforeEach(truncateAll);

  it('stock=1 with 500 concurrent reservations yields exactly 1 success', async () => {
    await seedProduct('flash-sku', 1);

    const attempts = Array.from({ length: 500 }, (_, i) =>
      reservationService
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

    const snapshot = await productService.getAvailability('flash-sku');
    expect(snapshot.availableStock).toBe(0);
    expect(snapshot.activeReservations).toBe(1);
  });

  it('stock=N under 500 concurrent reservations yields exactly N successes', async () => {
    const stock = 25;
    const requests = 500;
    await seedProduct('bulk-sku', stock);

    const attempts = Array.from({ length: requests }, (_, i) =>
      reservationService
        .reserve({ productId: 'bulk-sku', userId: `user-${i}`, quantity: 1 })
        .then(() => true)
        .catch(() => false),
    );
    const results = await Promise.all(attempts);
    const successes = results.filter(Boolean).length;

    expect(successes).toBe(stock);
    expect((await productService.getAvailability('bulk-sku')).availableStock).toBe(0);
  });

  it('parallelizes across products (no head-of-line blocking)', async () => {
    for (let i = 0; i < 10; i += 1) {
      await seedProduct(`sku-${i}`, 1);
    }

    const attempts = Array.from({ length: 10 }, (_, i) =>
      reservationService.reserve({ productId: `sku-${i}`, userId: `user-${i}`, quantity: 1 }),
    );
    const reservations = await Promise.all(attempts);
    expect(reservations).toHaveLength(10);
    expect(reservations.every((r) => r.state === ReservationState.ACTIVE)).toBe(true);
  });

  it('mixed reserve/confirm/cancel bursts never oversell', async () => {
    await seedProduct('sku', 10);

    const reserved: string[] = [];
    const ops: Array<Promise<unknown>> = [];
    for (let i = 0; i < 100; i += 1) {
      ops.push(
        reservationService
          .reserve({ productId: 'sku', userId: `u-${i}`, quantity: 1 })
          .then((r) => reserved.push(r.id))
          .catch(() => undefined),
      );
    }
    await Promise.all(ops);

    const decisions = reserved.map((id, idx) =>
      idx % 2 === 0
        ? reservationService.confirm(id).catch(() => undefined)
        : reservationService.cancel(id).catch(() => undefined),
    );
    await Promise.all(decisions);

    const snapshot = await productService.getAvailability('sku');
    expect(snapshot.confirmedSales + snapshot.activeReservations).toBeLessThanOrEqual(
      snapshot.totalStock,
    );
    expect(snapshot.availableStock).toBeGreaterThanOrEqual(0);
  });
});
