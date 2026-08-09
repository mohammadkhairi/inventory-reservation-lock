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
import { createLogger } from '../utils/logger.js';
import { locker } from '../utils/locker.js';

const log = createLogger('reservationService');

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
  log.info({ input }, 'reserve requested');

  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    log.warn({ quantity: input.quantity }, 'invalid quantity');
    throw new InvalidQuantityError(input.quantity);
  }

  return locker.withLock(input.productId, async () => {
    const product = await products.findById(input.productId);
    if (!product) {
      log.warn({ productId: input.productId }, 'product not found');
      throw new ProductNotFoundError(input.productId);
    }

    const now = Date.now();
    const records = await reservations.findByProductId(input.productId);
    const view = computeAvailability({ product, reservations: records, now });
    if (view.availableStock < input.quantity) {
      log.warn(
        {
          productId: input.productId,
          requested: input.quantity,
          available: view.availableStock,
        },
        'insufficient stock',
      );
      throw new InsufficientStockError({
        available: view.availableStock,
        requested: input.quantity,
      });
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
    log.info({ reservationId: reservation.id, productId: reservation.productId }, 'reserved');
    return reservation;
  });
}

export async function confirm(id: string): Promise<Reservation> {
  return transition({ reservationId: id, target: ReservationState.CONFIRMED });
}

export async function cancel(id: string): Promise<Reservation> {
  return transition({ reservationId: id, target: ReservationState.CANCELLED });
}

async function transition(params: {
  reservationId: string;
  target: typeof ReservationState.CONFIRMED | typeof ReservationState.CANCELLED;
}): Promise<Reservation> {
  const { reservationId, target } = params;
  const verb = target.toLowerCase();
  log.info({ reservationId, target }, 'transition requested');

  // One lookup outside the lock to find the productId to lock on. All state
  // decisions are re-read inside the lock below.
  const preview = await reservations.findById(reservationId);
  if (!preview) {
    log.warn({ reservationId }, 'reservation not found');
    throw new ReservationNotFoundError(reservationId);
  }

  return locker.withLock(preview.productId, async () => {
    const current = await reservations.findById(reservationId);
    if (!current) {
      log.warn({ reservationId }, 'reservation not found (post-lock)');
      throw new ReservationNotFoundError(reservationId);
    }

    const now = Date.now();
    const observed = effectiveState({ reservation: current, now });
    if (observed !== ReservationState.ACTIVE) {
      log.warn({ reservationId, observed, target }, 'invalid reservation state');
      throw new InvalidReservationStateError({ current: observed, attempted: verb });
    }

    const updated = withState({ reservation: current, state: target, now });
    await reservations.save(updated);
    log.info({ reservationId, target }, 'transitioned');
    return updated;
  });
}
