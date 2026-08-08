import { eq } from 'drizzle-orm';
import { db } from '../db/db.js';
import {
  reservationInsertSchema,
  reservations,
  type ReservationSelect,
} from '../db/schema/reservation.js';
import type { Reservation, ReservationState } from '../domain/reservation.js';

export interface ReservationRepository {
  findById(id: string): Promise<Reservation | null>;
  findByProductId(productId: string): Promise<Reservation[]>;
  save(reservation: Reservation): Promise<void>;
  all(): Promise<Reservation[]>;
}

/** DB row → domain. The pgEnum guarantees `state` is a valid ReservationState. */
const toDomain = (row: ReservationSelect): Reservation => ({
  ...row,
  state: row.state as ReservationState,
});

/**
 * Factory. Closes over the module-level `db()` helper — when called inside a
 * `locker.withLock` critical section, `db()` returns the current transaction
 * (via AsyncLocalStorage) so writes participate in the advisory-locked tx.
 */
export const reservationRepository = (): ReservationRepository => ({
  async findById(id) {
    const [row] = await db().select().from(reservations).where(eq(reservations.id, id)).limit(1);
    return row ? toDomain(row) : null;
  },

  async findByProductId(productId) {
    const rows = await db()
      .select()
      .from(reservations)
      .where(eq(reservations.productId, productId));
    return rows.map(toDomain);
  },

  async save(reservation) {
    const value = reservationInsertSchema.parse(reservation);
    await db()
      .insert(reservations)
      .values(value)
      .onConflictDoUpdate({
        target: reservations.id,
        set: { state: value.state, updatedAt: value.updatedAt, expiresAt: value.expiresAt },
      });
  },

  async all() {
    const rows = await db().select().from(reservations);
    return rows.map(toDomain);
  },
});
