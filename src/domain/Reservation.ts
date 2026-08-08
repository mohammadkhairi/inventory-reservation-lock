import type { Product } from './product.js';

export enum ReservationState {
  ACTIVE = 'ACTIVE',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export interface Reservation {
  readonly id: string;
  readonly productId: string;
  readonly userId: string;
  readonly quantity: number;
  readonly state: ReservationState;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly expiresAt: number;
}

export interface AvailabilitySnapshot {
  productId: string;
  totalStock: number;
  activeReservations: number;
  confirmedSales: number;
  availableStock: number;
}

export function withState(r: Reservation, state: ReservationState, now: number): Reservation {
  return { ...r, state, updatedAt: now };
}

/**
 * An ACTIVE reservation past its `expiresAt` counts as EXPIRED for availability
 * even before the sweeper materializes the transition — so a stalled sweeper can
 * never cause a phantom hold.
 */
export function effectiveState(r: Reservation, now: number): ReservationState {
  if (r.state === ReservationState.ACTIVE && r.expiresAt <= now) {
    return ReservationState.EXPIRED;
  }
  return r.state;
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
