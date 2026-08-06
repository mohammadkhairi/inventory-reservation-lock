import { ReservationState } from './ReservationState.js';

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

export function withState(
  reservation: Reservation,
  state: ReservationState,
  now: number,
): Reservation {
  return { ...reservation, state, updatedAt: now };
}

/**
 * Returns the reservation's *effective* state at `now` without persisting a change.
 * An ACTIVE reservation whose `expiresAt` has passed is effectively EXPIRED.
 */
export function effectiveState(reservation: Reservation, now: number): ReservationState {
  if (reservation.state === ReservationState.ACTIVE && reservation.expiresAt <= now) {
    return ReservationState.EXPIRED;
  }
  return reservation.state;
}

/**
 * Whether the reservation currently consumes inventory (active hold or confirmed sale).
 * Uses `effectiveState` so expired holds correctly release stock even before persistence.
 */
export function consumesInventory(reservation: Reservation, now: number): boolean {
  const state = effectiveState(reservation, now);
  return state === ReservationState.ACTIVE || state === ReservationState.CONFIRMED;
}
