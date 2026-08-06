import { describe, it, expect } from 'vitest';
import { makeHarness } from './helpers.js';
import { ReservationState } from '../src/domain/ReservationState.js';
import {
  InvalidReservationStateError,
  ReservationNotFoundError,
} from '../src/domain/errors.js';

const TWO_MINUTES = 2 * 60 * 1000;

describe('Level 2 — reservation lifecycle', () => {
  it('transitions ACTIVE → CONFIRMED and permanently consumes stock', async () => {
    const h = await makeHarness();
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
    const h = await makeHarness();
    await h.seedProduct('sku', 1);

    const r = await h.service.reserve({ productId: 'sku', userId: 'A', quantity: 1 });
    const cancelled = await h.service.cancel(r.id);

    expect(cancelled.state).toBe(ReservationState.CANCELLED);
    const snapshot = await h.service.getAvailability('sku');
    expect(snapshot.availableStock).toBe(1);
  });

  it('auto-releases stock once the 2-minute hold elapses (lazy)', async () => {
    const h = await makeHarness({ holdDurationMs: TWO_MINUTES });
    await h.seedProduct('sku', 1);

    await h.service.reserve({ productId: 'sku', userId: 'A', quantity: 1 });
    expect((await h.service.getAvailability('sku')).availableStock).toBe(0);

    h.clock.advance(TWO_MINUTES + 1);

    const snapshot = await h.service.getAvailability('sku');
    expect(snapshot.availableStock).toBe(1);
    expect(snapshot.activeReservations).toBe(0);
  });

  it('allows a new reservation after an expired hold', async () => {
    const h = await makeHarness({ holdDurationMs: TWO_MINUTES });
    await h.seedProduct('sku', 1);
    await h.service.reserve({ productId: 'sku', userId: 'A', quantity: 1 });

    h.clock.advance(TWO_MINUTES + 1);

    const next = await h.service.reserve({ productId: 'sku', userId: 'B', quantity: 1 });
    expect(next.state).toBe(ReservationState.ACTIVE);
  });

  it('sweepExpired persists ACTIVE → EXPIRED transitions', async () => {
    const h = await makeHarness({ holdDurationMs: TWO_MINUTES });
    await h.seedProduct('sku', 3);

    const r1 = await h.service.reserve({ productId: 'sku', userId: 'A', quantity: 1 });
    const r2 = await h.service.reserve({ productId: 'sku', userId: 'B', quantity: 1 });

    h.clock.advance(TWO_MINUTES + 1);
    const expired = await h.service.sweepExpired();

    expect(expired.map((r) => r.id).sort()).toEqual([r1.id, r2.id].sort());
    const persisted1 = await h.reservations.findById(r1.id);
    const persisted2 = await h.reservations.findById(r2.id);
    expect(persisted1?.state).toBe(ReservationState.EXPIRED);
    expect(persisted2?.state).toBe(ReservationState.EXPIRED);
  });

  it('rejects confirming an EXPIRED reservation', async () => {
    const h = await makeHarness({ holdDurationMs: TWO_MINUTES });
    await h.seedProduct('sku', 1);

    const r = await h.service.reserve({ productId: 'sku', userId: 'A', quantity: 1 });
    h.clock.advance(TWO_MINUTES + 1);

    await expect(h.service.confirm(r.id)).rejects.toBeInstanceOf(InvalidReservationStateError);
  });

  it('rejects double-confirm', async () => {
    const h = await makeHarness();
    await h.seedProduct('sku', 1);
    const r = await h.service.reserve({ productId: 'sku', userId: 'A', quantity: 1 });
    await h.service.confirm(r.id);
    await expect(h.service.confirm(r.id)).rejects.toBeInstanceOf(InvalidReservationStateError);
  });

  it('rejects cancelling a CONFIRMED reservation (purchases are final)', async () => {
    const h = await makeHarness();
    await h.seedProduct('sku', 1);
    const r = await h.service.reserve({ productId: 'sku', userId: 'A', quantity: 1 });
    await h.service.confirm(r.id);
    await expect(h.service.cancel(r.id)).rejects.toBeInstanceOf(InvalidReservationStateError);
  });

  it('rejects operations on unknown reservations', async () => {
    const h = await makeHarness();
    await expect(h.service.confirm('nope')).rejects.toBeInstanceOf(ReservationNotFoundError);
    await expect(h.service.cancel('nope')).rejects.toBeInstanceOf(ReservationNotFoundError);
  });
});
