import { randomUUID } from 'node:crypto';

import { DEFAULT_HOLD_DURATION_MS } from '../config/constants.js';
import { ReservationState } from '../db/schema/reservation.js';
import {
  InsufficientStockError,
  InvalidQuantityError,
  InvalidReservationStateError,
  ProductNotFoundError,
  ReservationNotFoundError,
} from '../errors.js';
import * as products from '../repositories/productRepository.js';
import * as reservations from '../repositories/reservationRepository.js';
import { computeAvailability, effectiveState, withState } from '../rules/reservationRules.js';
import type { Reservation } from '../types/reservation.js';
import { locker } from '../utils/locker.js';

export interface ReserveInput {
  productId: string;
  userId: string;
  quantity: number;
}

/**
 * Every read-then-write runs inside `locker.withLock(productId, …)` so
 * overselling is impossible. Backed by `pg_advisory_xact_lock` inside a
 * transaction whose handle flows to repositories via AsyncLocalStorage.
 */
export async function reserve(input: ReserveInput): Promise<Reservation> {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new InvalidQuantityError(input.quantity);
  }
  return locker.withLock(input.productId, async () => {
    const product = await products.findById(input.productId);
    if (!product) throw new ProductNotFoundError(input.productId);

    const now = Date.now();
    const records = await reservations.findByProductId(input.productId);
    const view = computeAvailability(product, records, now);
    if (view.availableStock < input.quantity) {
      throw new InsufficientStockError(view.availableStock, input.quantity);
    }

    const reservation: Reservation = {
      ...input,
      id: randomUUID(),
      state: ReservationState.ACTIVE,
      createdAt: now,
      updatedAt: now,
      expiresAt: now + DEFAULT_HOLD_DURATION_MS,
    };
    await reservations.save(reservation);
    return reservation;
  });
}

export async function confirm(id: string): Promise<Reservation> {
  return transition(id, ReservationState.CONFIRMED);
}

export async function cancel(id: string): Promise<Reservation> {
  return transition(id, ReservationState.CANCELLED);
}

async function transition(
  reservationId: string,
  target: typeof ReservationState.CONFIRMED | typeof ReservationState.CANCELLED,
): Promise<Reservation> {
  const verb = target.toLowerCase();

  // One lookup outside the lock to find the productId to lock on. All state
  // decisions are re-read inside the lock below.
  const preview = await reservations.findById(reservationId);
  if (!preview) throw new ReservationNotFoundError(reservationId);

  return locker.withLock(preview.productId, async () => {
    const current = await reservations.findById(reservationId);
    if (!current) throw new ReservationNotFoundError(reservationId);

    const now = Date.now();
    const observed = effectiveState(current, now);
    if (observed !== ReservationState.ACTIVE) {
      throw new InvalidReservationStateError(observed, verb);
    }

    const updated = withState(current, target, now);
    await reservations.save(updated);
    return updated;
  });
}
