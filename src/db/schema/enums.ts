import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * Reservation states — the pg enum (the DB constraint) and the TS enum
 * (the app-side type) share the same underlying string values. Colocated so
 * they can never drift.
 */
const RESERVATION_STATES = ['ACTIVE', 'CONFIRMED', 'CANCELLED', 'EXPIRED'] as const;

export const reservationStateEnum = pgEnum('reservation_state', RESERVATION_STATES);

export const ReservationState = {
  ACTIVE: 'ACTIVE',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
} as const;

export type ReservationState = (typeof RESERVATION_STATES)[number];
