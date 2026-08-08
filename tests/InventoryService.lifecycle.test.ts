import { beforeEach, describe, it, expect } from 'vitest';
import { makeHarness, truncateAll } from './helpers.js';
import { DEFAULT_HOLD_DURATION_MS } from '../src/config/constants.js';
import { InvalidReservationStateError, ReservationNotFoundError } from '../src/domain/errors.js';
import { ReservationState } from '../src/domain/reservation.js';

const HOLD_MS = DEFAULT_HOLD_DURATION_MS;
const JUST_PAST_EXPIRY_MS = HOLD_MS + 1;

describe('InventoryService — lifecycle (confirm / cancel / expiry)', () => {
  beforeEach(truncateAll);

  it('transitions ACTIVE → CONFIRMED and permanently consumes stock', async () => {
    const h = makeHarness();
    await h.seedProduct('sku', 1);

    const r = await h.service.reserve({ productId: 'sku', userId: 'A', quantity: 1 });
    const confirmed = await h.service.confirm(r.id);

    expect(confirmed.state).toBe(ReservationState.CONFIRMED);
    const snapshot = await h.service.getAvailability('sku');
    expect(snapshot.availableStock).toBe(0);
    expect(snapshot.confirmedSales).toBe(1);
    expect(snapshot.activeReservations).toBe(0);
  });

  it('transitions ACTIVE → CANCELLED and releases stock', async () => {
    const h = makeHarness();
    await h.seedProduct('sku', 1);

    const r = await h.service.reserve({ productId: 'sku', userId: 'A', quantity: 1 });
    const cancelled = await h.service.cancel(r.id);

    expect(cancelled.state).toBe(ReservationState.CANCELLED);
    const snapshot = await h.service.getAvailability('sku');
    expect(snapshot.availableStock).toBe(1);
  });

  it('auto-releases stock once the 2-minute hold elapses (lazy)', async () => {
    const h = makeHarness({ holdDurationMs: HOLD_MS });
    await h.seedProduct('sku', 1);

    await h.service.reserve({ productId: 'sku', userId: 'A', quantity: 1 });
    expect((await h.service.getAvailability('sku')).availableStock).toBe(0);

    h.clock.advance(JUST_PAST_EXPIRY_MS);

    const snapshot = await h.service.getAvailability('sku');
    expect(snapshot.availableStock).toBe(1);
    expect(snapshot.activeReservations).toBe(0);
  });

  it('allows a new reservation after an expired hold', async () => {
    const h = makeHarness({ holdDurationMs: HOLD_MS });
    await h.seedProduct('sku', 1);
    await h.service.reserve({ productId: 'sku', userId: 'A', quantity: 1 });

    h.clock.advance(JUST_PAST_EXPIRY_MS);

    const next = await h.service.reserve({ productId: 'sku', userId: 'B', quantity: 1 });
    expect(next.state).toBe(ReservationState.ACTIVE);
  });

  it('rejects confirming an EXPIRED reservation', async () => {
    const h = makeHarness({ holdDurationMs: HOLD_MS });
    await h.seedProduct('sku', 1);

    const r = await h.service.reserve({ productId: 'sku', userId: 'A', quantity: 1 });
    h.clock.advance(JUST_PAST_EXPIRY_MS);

    await expect(h.service.confirm(r.id)).rejects.toBeInstanceOf(InvalidReservationStateError);
  });

  it('rejects double-confirm', async () => {
    const h = makeHarness();
    await h.seedProduct('sku', 1);
    const r = await h.service.reserve({ productId: 'sku', userId: 'A', quantity: 1 });
    await h.service.confirm(r.id);
    await expect(h.service.confirm(r.id)).rejects.toBeInstanceOf(InvalidReservationStateError);
  });

  it('rejects cancelling a CONFIRMED reservation (purchases are final)', async () => {
    const h = makeHarness();
    await h.seedProduct('sku', 1);
    const r = await h.service.reserve({ productId: 'sku', userId: 'A', quantity: 1 });
    await h.service.confirm(r.id);
    await expect(h.service.cancel(r.id)).rejects.toBeInstanceOf(InvalidReservationStateError);
  });

  it('rejects operations on unknown reservations', async () => {
    const h = makeHarness();
    await expect(h.service.confirm('nope')).rejects.toBeInstanceOf(ReservationNotFoundError);
    await expect(h.service.cancel('nope')).rejects.toBeInstanceOf(ReservationNotFoundError);
  });
});
