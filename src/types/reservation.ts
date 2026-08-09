import type { ReservationState } from '../db/schema/reservation.js';

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
