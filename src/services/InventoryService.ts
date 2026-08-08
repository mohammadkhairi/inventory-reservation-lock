import { randomUUID } from 'node:crypto';
import { DEFAULT_HOLD_DURATION_MS } from '../config/constants.js';
import {
  InsufficientStockError,
  InvalidQuantityError,
  InvalidReservationStateError,
  ProductNotFoundError,
  ReservationNotFoundError,
} from '../domain/errors.js';
import type { Product } from '../domain/product.js';
import {
  computeAvailability,
  effectiveState,
  withState,
  ReservationState,
  type AvailabilitySnapshot,
  type Reservation,
} from '../domain/reservation.js';
import type { Clock } from '../infrastructure/clock.js';
import type { Locker } from '../infrastructure/locker.js';
import type { ProductRepository } from '../repositories/productRepository.js';
import type { ReservationRepository } from '../repositories/reservationRepository.js';

export interface ReserveInput {
  productId: string;
  userId: string;
  quantity: number;
}

export interface InventoryService {
  getAvailability(productId: string): Promise<AvailabilitySnapshot>;
  reserve(input: ReserveInput): Promise<Reservation>;
  confirm(reservationId: string): Promise<Reservation>;
  cancel(reservationId: string): Promise<Reservation>;
  /** Materializes ACTIVE→EXPIRED for audit visibility. Availability never depends on it. */
  sweepExpired(): Promise<Reservation[]>;
}

export interface InventoryServiceDeps {
  products: ProductRepository;
  reservations: ReservationRepository;
  locker: Locker;
  clock: Clock;
  holdDurationMs?: number;
}

/**
 * Every read-then-write runs inside `locker.withLock(productId, …)` so
 * overselling is impossible. Backed by `pg_advisory_xact_lock` inside a
 * transaction whose handle flows to repositories via AsyncLocalStorage.
 */
export const createInventoryService = (deps: InventoryServiceDeps): InventoryService => {
  const { products, reservations, locker, clock } = deps;
  const holdDurationMs = deps.holdDurationMs ?? DEFAULT_HOLD_DURATION_MS;

  const requireProduct = async (id: string): Promise<Product> => {
    const product = await products.findById(id);
    if (!product) throw new ProductNotFoundError(id);
    return product;
  };

  const transition = async (
    reservationId: string,
    target: ReservationState.CONFIRMED | ReservationState.CANCELLED,
    verb: 'confirm' | 'cancel',
  ): Promise<Reservation> => {
    // One lookup outside the lock to find the productId to lock on. All state
    // decisions are re-read inside the lock below.
    const preview = await reservations.findById(reservationId);
    if (!preview) throw new ReservationNotFoundError(reservationId);

    return locker.withLock(preview.productId, async () => {
      const current = await reservations.findById(reservationId);
      if (!current) throw new ReservationNotFoundError(reservationId);

      const now = clock.now();
      const observed = effectiveState(current, now);
      if (observed !== ReservationState.ACTIVE) {
        if (observed === ReservationState.EXPIRED && current.state === ReservationState.ACTIVE) {
          await reservations.save(withState(current, ReservationState.EXPIRED, now));
        }
        throw new InvalidReservationStateError(observed, verb);
      }

      const updated = withState(current, target, now);
      await reservations.save(updated);
      return updated;
    });
  };

  return {
    getAvailability: (productId) =>
      locker.withLock(productId, async () => {
        const product = await requireProduct(productId);
        const records = await reservations.findByProductId(productId);
        return computeAvailability(product, records, clock.now());
      }),

    reserve: async (input) => {
      if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
        throw new InvalidQuantityError(input.quantity);
      }
      return locker.withLock(input.productId, async () => {
        const product = await requireProduct(input.productId);
        const records = await reservations.findByProductId(input.productId);
        const view = computeAvailability(product, records, clock.now());
        if (view.availableStock < input.quantity) {
          throw new InsufficientStockError(view.availableStock, input.quantity);
        }
        const now = clock.now();
        const reservation: Reservation = {
          id: randomUUID(),
          productId: input.productId,
          userId: input.userId,
          quantity: input.quantity,
          state: ReservationState.ACTIVE,
          createdAt: now,
          updatedAt: now,
          expiresAt: now + holdDurationMs,
        };
        await reservations.save(reservation);
        return reservation;
      });
    },

    confirm: (id) => transition(id, ReservationState.CONFIRMED, 'confirm'),
    cancel: (id) => transition(id, ReservationState.CANCELLED, 'cancel'),

    sweepExpired: async () => {
      const now = clock.now();
      const all = await reservations.all();
      const byProduct = new Map<string, Reservation[]>();
      for (const r of all) {
        if (r.state === ReservationState.ACTIVE && r.expiresAt <= now) {
          (byProduct.get(r.productId) ?? byProduct.set(r.productId, []).get(r.productId)!).push(r);
        }
      }

      const perProduct = await Promise.all(
        Array.from(byProduct, ([productId, bucket]) =>
          locker.withLock(productId, async () => {
            const out: Reservation[] = [];
            for (const r of bucket) {
              const current = await reservations.findById(r.id);
              if (!current) continue;
              if (current.state === ReservationState.ACTIVE && current.expiresAt <= clock.now()) {
                const updated = withState(current, ReservationState.EXPIRED, clock.now());
                await reservations.save(updated);
                out.push(updated);
              }
            }
            return out;
          }),
        ),
      );
      return perProduct.flat();
    },
  };
};
