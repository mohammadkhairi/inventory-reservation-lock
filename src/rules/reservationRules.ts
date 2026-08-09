import { ReservationState } from '../db/schema/enums.js';
import type { Product } from '../types/product.js';
import type { AvailabilitySnapshot, Reservation } from '../types/reservation.js';

/**
 * Pure business rules. No I/O, no clock reads, no locks — every input is
 * explicit. Freely reusable across services and testable in isolation.
 */

/**
 * An ACTIVE reservation past its `expiresAt` counts as EXPIRED for availability.
 * The persisted state may still read ACTIVE — availability doesn't care.
 */
export function effectiveState(r: Reservation, now: number): ReservationState {
  if (r.state === ReservationState.ACTIVE && r.expiresAt <= now) {
    return ReservationState.EXPIRED;
  }
  return r.state;
}

export function withState(r: Reservation, state: ReservationState, now: number): Reservation {
  return { ...r, state, updatedAt: now };
}

export function computeAvailability(
  product: Product,
  reservations: readonly Reservation[],
  now: number,
): AvailabilitySnapshot {
  let active = 0;
  let confirmed = 0;
  for (const r of reservations) {
    const state = effectiveState(r, now);
    if (state === ReservationState.ACTIVE) active += r.quantity;
    else if (state === ReservationState.CONFIRMED) confirmed += r.quantity;
  }
  return {
    productId: product.id,
    totalStock: product.totalStock,
    activeReservations: active,
    confirmedSales: confirmed,
    availableStock: Math.max(0, product.totalStock - active - confirmed),
  };
}
