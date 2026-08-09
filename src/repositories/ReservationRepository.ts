import { eq } from 'drizzle-orm';
import { db } from '../db/db.js';
import {
  reservationInsertSchema,
  reservations,
  type ReservationSelect,
} from '../db/schema/reservation.js';
import type { ReservationState } from '../db/schema/reservation.js';
import type { Reservation } from '../types/reservation.js';

/**
 * Shape a caller can hold as a `reservations` value.
 * `import * as reservations from './reservationRepository.js'` satisfies this.
 */
export interface ReservationRepository {
  findById(id: string): Promise<Reservation | null>;
  findByProductId(productId: string): Promise<Reservation[]>;
  save(reservation: Reservation): Promise<void>;
}

/** DB row → domain. The pgEnum guarantees `state` is a valid ReservationState. */
function toDomain(row: ReservationSelect): Reservation {
  return { ...row, state: row.state as ReservationState };
}

export async function findById(id: string): Promise<Reservation | null> {
  const row = await db().query.reservations.findFirst({ where: eq(reservations.id, id) });
  return row ? toDomain(row) : null;
}

export async function findByProductId(productId: string): Promise<Reservation[]> {
  const rows = await db().query.reservations.findMany({
    where: eq(reservations.productId, productId),
  });
  return rows.map(toDomain);
}

export async function save(reservation: Reservation): Promise<void> {
  const value = reservationInsertSchema.parse(reservation);
  await db()
    .insert(reservations)
    .values(value)
    .onConflictDoUpdate({
      target: reservations.id,
      set: { state: value.state, updatedAt: value.updatedAt, expiresAt: value.expiresAt },
    });
}
