import type { Product } from '../domain/Product.js';
import { effectiveState, withState, type Reservation } from '../domain/Reservation.js';
import { ReservationState } from '../domain/ReservationState.js';
import {
  InsufficientStockError,
  InvalidQuantityError,
  InvalidReservationStateError,
  ProductNotFoundError,
  ReservationNotFoundError,
} from '../domain/errors.js';
import type { Clock } from '../infrastructure/Clock.js';
import type { IdGenerator } from '../infrastructure/IdGenerator.js';
import { KeyedMutex } from '../infrastructure/KeyedMutex.js';
import type { ProductRepository } from '../repositories/ProductRepository.js';
import type { ReservationRepository } from '../repositories/ReservationRepository.js';
import { DEFAULT_HOLD_DURATION_MS } from '../config/constants.js';

export interface AvailabilitySnapshot {
  productId: string;
  totalStock: number;
  activeReservations: number;
  confirmedSales: number;
  availableStock: number;
}

export interface InventoryServiceOptions {
  products: ProductRepository;
  reservations: ReservationRepository;
  clock: Clock;
  idGenerator: IdGenerator;
  /** Locking strategy — injectable so tests can substitute a spy. */
  mutex?: KeyedMutex;
  /** How long an ACTIVE reservation holds stock. Defaults to 2 minutes. */
  holdDurationMs?: number;
}

/**
 * Coordinates all reservation lifecycle transitions.
 *
 * ## Concurrency model
 * Every operation that reads-then-writes reservation state for a product goes
 * through `mutex.runExclusive(productId, ...)`. Because there is exactly one
 * lock per product, operations on different products run in parallel while
 * operations on the same product are serialized. This is the natural
 * granularity for inventory: overselling is a per-product invariant.
 *
 * Consistency is enforced by the formula
 *   available = totalStock − Σ quantity(reservations where effectiveState ∈ {ACTIVE, CONFIRMED})
 * evaluated inside the lock immediately before the write.
 *
 * ## Expiry model
 * We use *lazy expiry*: `effectiveState` treats any ACTIVE reservation past
 * `expiresAt` as EXPIRED for availability math, regardless of what is on disk.
 * `sweepExpired` optionally persists those transitions so audit reads see the
 * final state. Correctness of availability never depends on the sweeper
 * running.
 */
export class InventoryService {
  private readonly products: ProductRepository;
  private readonly reservations: ReservationRepository;
  private readonly clock: Clock;
  private readonly idGenerator: IdGenerator;
  private readonly mutex: KeyedMutex;
  private readonly holdDurationMs: number;

  constructor(options: InventoryServiceOptions) {
    this.products = options.products;
    this.reservations = options.reservations;
    this.clock = options.clock;
    this.idGenerator = options.idGenerator;
    this.mutex = options.mutex ?? new KeyedMutex();
    this.holdDurationMs = options.holdDurationMs ?? DEFAULT_HOLD_DURATION_MS;
  }

  async getAvailability(productId: string): Promise<AvailabilitySnapshot> {
    return this.mutex.runExclusive(productId, async () => {
      const product = await this.requireProduct(productId);
      const reservations = await this.reservations.findByProductId(productId);
      return this.snapshot(product, reservations);
    });
  }

  async reserve(input: {
    productId: string;
    userId: string;
    quantity: number;
  }): Promise<Reservation> {
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new InvalidQuantityError(input.quantity);
    }

    return this.mutex.runExclusive(input.productId, async () => {
      const product = await this.requireProduct(input.productId);
      const reservations = await this.reservations.findByProductId(input.productId);
      const snapshot = this.snapshot(product, reservations);

      if (snapshot.availableStock < input.quantity) {
        throw new InsufficientStockError(snapshot.availableStock, input.quantity);
      }

      const now = this.clock.now();
      const reservation: Reservation = {
        id: this.idGenerator.next(),
        productId: input.productId,
        userId: input.userId,
        quantity: input.quantity,
        state: ReservationState.ACTIVE,
        createdAt: now,
        updatedAt: now,
        expiresAt: now + this.holdDurationMs,
      };
      await this.reservations.save(reservation);
      return reservation;
    });
  }

  async confirm(reservationId: string): Promise<Reservation> {
    return this.transition(reservationId, ReservationState.CONFIRMED, 'confirm');
  }

  async cancel(reservationId: string): Promise<Reservation> {
    return this.transition(reservationId, ReservationState.CANCELLED, 'cancel');
  }

  /**
   * Persists ACTIVE→EXPIRED transitions for any reservation whose hold has
   * elapsed. Safe to call at any cadence; correctness does not depend on it.
   * Returns the reservations that were transitioned.
   */
  async sweepExpired(): Promise<Reservation[]> {
    const now = this.clock.now();
    const all = await this.reservations.all();
    const dueByProduct = new Map<string, Reservation[]>();
    for (const r of all) {
      if (r.state === ReservationState.ACTIVE && r.expiresAt <= now) {
        const bucket = dueByProduct.get(r.productId) ?? [];
        bucket.push(r);
        dueByProduct.set(r.productId, bucket);
      }
    }

    const expired: Reservation[] = [];
    for (const [productId, bucket] of dueByProduct) {
      // Re-check inside the lock so a concurrent confirm/cancel wins deterministically.
      const swept = await this.mutex.runExclusive(productId, async () => {
        const result: Reservation[] = [];
        for (const r of bucket) {
          const current = await this.reservations.findById(r.id);
          if (!current) continue;
          if (current.state === ReservationState.ACTIVE && current.expiresAt <= this.clock.now()) {
            const updated = withState(current, ReservationState.EXPIRED, this.clock.now());
            await this.reservations.save(updated);
            result.push(updated);
          }
        }
        return result;
      });
      expired.push(...swept);
    }
    return expired;
  }

  private async transition(
    reservationId: string,
    target: ReservationState.CONFIRMED | ReservationState.CANCELLED,
    verb: 'confirm' | 'cancel',
  ): Promise<Reservation> {
    // Fetch outside the lock only to discover the productId to lock on.
    // All state decisions are re-read inside the lock below.
    const preview = await this.reservations.findById(reservationId);
    if (!preview) throw new ReservationNotFoundError(reservationId);

    return this.mutex.runExclusive(preview.productId, async () => {
      const current = await this.reservations.findById(reservationId);
      if (!current) throw new ReservationNotFoundError(reservationId);

      const now = this.clock.now();
      const observed = effectiveState(current, now);

      if (observed !== ReservationState.ACTIVE) {
        // Persist the observed EXPIRED state if we noticed it here, so the
        // stored state matches what the caller was told.
        if (observed === ReservationState.EXPIRED && current.state === ReservationState.ACTIVE) {
          await this.reservations.save(withState(current, ReservationState.EXPIRED, now));
        }
        throw new InvalidReservationStateError(observed, verb);
      }

      const updated = withState(current, target, now);
      await this.reservations.save(updated);
      return updated;
    });
  }

  private snapshot(product: Product, reservations: Reservation[]): AvailabilitySnapshot {
    const now = this.clock.now();
    let activeQty = 0;
    let confirmedQty = 0;
    for (const r of reservations) {
      const state = effectiveState(r, now);
      if (state === ReservationState.ACTIVE) activeQty += r.quantity;
      else if (state === ReservationState.CONFIRMED) confirmedQty += r.quantity;
    }
    const availableStock = Math.max(0, product.totalStock - activeQty - confirmedQty);
    return {
      productId: product.id,
      totalStock: product.totalStock,
      activeReservations: activeQty,
      confirmedSales: confirmedQty,
      availableStock,
    };
  }

  private async requireProduct(productId: string): Promise<Product> {
    const product = await this.products.findById(productId);
    if (!product) throw new ProductNotFoundError(productId);
    return product;
  }
}
