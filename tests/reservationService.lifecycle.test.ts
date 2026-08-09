import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { seedProduct, truncateAll } from './helpers.js';
import { DEFAULT_HOLD_DURATION_MS } from '../src/config/constants.js';
import { InvalidReservationStateError, ReservationNotFoundError } from '../src/errors.js';
import * as productService from '../src/services/productService.js';
import * as reservationService from '../src/services/reservationService.js';
import { ReservationState } from '../src/db/schema/reservation.js';

const JUST_PAST_EXPIRY_MS = DEFAULT_HOLD_DURATION_MS + 1;
const TEST_START = new Date('2023-11-14T22:13:20Z');

/** Advances the mocked wall clock without touching real timers. */
function advanceTime(ms: number): void {
  vi.setSystemTime(new Date(Date.now() + ms));
}

describe('reservationService — lifecycle (confirm / cancel / expiry)', () => {
  beforeEach(async () => {
    await truncateAll();
    // toFake: ['Date'] freezes wall-clock reads only. setTimeout/setInterval
    // (used by the Postgres client) still run on real time.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(TEST_START);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('transitions ACTIVE → CONFIRMED and permanently consumes stock', async () => {
    await seedProduct('sku', 1);

    const r = await reservationService.reserve({ productId: 'sku', userId: 'A', quantity: 1 });
    const confirmed = await reservationService.confirm(r.id);

    expect(confirmed.state).toBe(ReservationState.CONFIRMED);
    const snapshot = await productService.getAvailability('sku');
    expect(snapshot.availableStock).toBe(0);
    expect(snapshot.confirmedSales).toBe(1);
    expect(snapshot.activeReservations).toBe(0);
  });

  it('transitions ACTIVE → CANCELLED and releases stock', async () => {
    await seedProduct('sku', 1);

    const r = await reservationService.reserve({ productId: 'sku', userId: 'A', quantity: 1 });
    const cancelled = await reservationService.cancel(r.id);

    expect(cancelled.state).toBe(ReservationState.CANCELLED);
    const snapshot = await productService.getAvailability('sku');
    expect(snapshot.availableStock).toBe(1);
  });

  it('auto-releases stock once the hold elapses (lazy)', async () => {
    await seedProduct('sku', 1);
    await reservationService.reserve({ productId: 'sku', userId: 'A', quantity: 1 });
    expect((await productService.getAvailability('sku')).availableStock).toBe(0);

    advanceTime(JUST_PAST_EXPIRY_MS);

    const snapshot = await productService.getAvailability('sku');
    expect(snapshot.availableStock).toBe(1);
    expect(snapshot.activeReservations).toBe(0);
  });

  it('allows a new reservation after an expired hold', async () => {
    await seedProduct('sku', 1);
    await reservationService.reserve({ productId: 'sku', userId: 'A', quantity: 1 });

    advanceTime(JUST_PAST_EXPIRY_MS);

    const next = await reservationService.reserve({ productId: 'sku', userId: 'B', quantity: 1 });
    expect(next.state).toBe(ReservationState.ACTIVE);
  });

  it('rejects confirming an EXPIRED reservation', async () => {
    await seedProduct('sku', 1);
    const r = await reservationService.reserve({ productId: 'sku', userId: 'A', quantity: 1 });

    advanceTime(JUST_PAST_EXPIRY_MS);

    await expect(reservationService.confirm(r.id)).rejects.toBeInstanceOf(
      InvalidReservationStateError,
    );
  });

  it('rejects double-confirm', async () => {
    await seedProduct('sku', 1);
    const r = await reservationService.reserve({ productId: 'sku', userId: 'A', quantity: 1 });
    await reservationService.confirm(r.id);
    await expect(reservationService.confirm(r.id)).rejects.toBeInstanceOf(
      InvalidReservationStateError,
    );
  });

  it('rejects cancelling a CONFIRMED reservation (purchases are final)', async () => {
    await seedProduct('sku', 1);
    const r = await reservationService.reserve({ productId: 'sku', userId: 'A', quantity: 1 });
    await reservationService.confirm(r.id);
    await expect(reservationService.cancel(r.id)).rejects.toBeInstanceOf(
      InvalidReservationStateError,
    );
  });

  it('rejects operations on unknown reservations', async () => {
    await expect(reservationService.confirm('nope')).rejects.toBeInstanceOf(
      ReservationNotFoundError,
    );
    await expect(reservationService.cancel('nope')).rejects.toBeInstanceOf(
      ReservationNotFoundError,
    );
  });
});
