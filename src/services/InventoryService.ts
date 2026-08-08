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

export interface InventoryServiceDeps {
  products: ProductRepository;
  reservations: ReservationRepository;
  locker: Locker;
  clock: Clock;
  holdDurationMs?: number;
}

async function requireProduct(deps: InventoryServiceDeps, id: string): Promise<Product> {
  const product = await deps.products.findById(id);
  if (!product) throw new ProductNotFoundError(id);
  return product;
}

async function transition(
  deps: InventoryServiceDeps,
  reservationId: string,
  target: ReservationState.CONFIRMED | ReservationState.CANCELLED,
  verb: 'confirm' | 'cancel',
): Promise<Reservation> {
  // One lookup outside the lock to find the productId to lock on. All state
  // decisions are re-read inside the lock below.
  const preview = await deps.reservations.findById(reservationId);
  if (!preview) throw new ReservationNotFoundError(reservationId);

  return deps.locker.withLock(preview.productId, async () => {
    const current = await deps.reservations.findById(reservationId);
    if (!current) throw new ReservationNotFoundError(reservationId);

    const now = deps.clock.now();
    const observed = effectiveState(current, now);
    if (observed !== ReservationState.ACTIVE) {
      if (observed === ReservationState.EXPIRED && current.state === ReservationState.ACTIVE) {
        await deps.reservations.save(withState(current, ReservationState.EXPIRED, now));
      }
      throw new InvalidReservationStateError(observed, verb);
    }

    const updated = withState(current, target, now);
    await deps.reservations.save(updated);
    return updated;
  });
}

/**
 * Every read-then-write runs inside `deps.locker.withLock(productId, …)` so
 * overselling is impossible. Backed by `pg_advisory_xact_lock` inside a
 * transaction whose handle flows to repositories via AsyncLocalStorage.
 */
export async function getAvailability(
  deps: InventoryServiceDeps,
  productId: string,
): Promise<AvailabilitySnapshot> {
  return deps.locker.withLock(productId, async () => {
    const product = await requireProduct(deps, productId);
    const records = await deps.reservations.findByProductId(productId);
    return computeAvailability(product, records, deps.clock.now());
  });
}

export async function reserve(
  deps: InventoryServiceDeps,
  input: ReserveInput,
): Promise<Reservation> {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new InvalidQuantityError(input.quantity);
  }
  const holdDurationMs = deps.holdDurationMs ?? DEFAULT_HOLD_DURATION_MS;
  return deps.locker.withLock(input.productId, async () => {
    const product = await requireProduct(deps, input.productId);
    const records = await deps.reservations.findByProductId(input.productId);
    const view = computeAvailability(product, records, deps.clock.now());
    if (view.availableStock < input.quantity) {
      throw new InsufficientStockError(view.availableStock, input.quantity);
    }
    const now = deps.clock.now();
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
    await deps.reservations.save(reservation);
    return reservation;
  });
}

export async function confirm(deps: InventoryServiceDeps, id: string): Promise<Reservation> {
  return transition(deps, id, ReservationState.CONFIRMED, 'confirm');
}

export async function cancel(deps: InventoryServiceDeps, id: string): Promise<Reservation> {
  return transition(deps, id, ReservationState.CANCELLED, 'cancel');
}
