import type { Reservation } from '../domain/Reservation.js';

export interface ReservationRepository {
  findById(id: string): Promise<Reservation | null>;
  findByProductId(productId: string): Promise<Reservation[]>;
  save(reservation: Reservation): Promise<void>;
  all(): Promise<Reservation[]>;
}

/**
 * In-memory reservation store. Reservations are kept immutable in the map, so
 * concurrent readers always observe a coherent snapshot even without locking
 * (locking is applied at the service layer, per product).
 */
export class InMemoryReservationRepository implements ReservationRepository {
  private readonly byId = new Map<string, Reservation>();
  private readonly byProduct = new Map<string, Set<string>>();

  async findById(id: string): Promise<Reservation | null> {
    return this.byId.get(id) ?? null;
  }

  async findByProductId(productId: string): Promise<Reservation[]> {
    const ids = this.byProduct.get(productId);
    if (!ids) return [];
    const result: Reservation[] = [];
    for (const id of ids) {
      const reservation = this.byId.get(id);
      if (reservation) result.push(reservation);
    }
    return result;
  }

  async save(reservation: Reservation): Promise<void> {
    this.byId.set(reservation.id, reservation);
    let ids = this.byProduct.get(reservation.productId);
    if (!ids) {
      ids = new Set();
      this.byProduct.set(reservation.productId, ids);
    }
    ids.add(reservation.id);
  }

  async all(): Promise<Reservation[]> {
    return Array.from(this.byId.values());
  }
}
