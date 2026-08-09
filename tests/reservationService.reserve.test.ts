import { beforeEach, describe, it, expect } from 'vitest';
import { seedProduct, truncateAll } from './helpers.js';
import {
  InsufficientStockError,
  InvalidQuantityError,
  ProductNotFoundError,
} from '../src/errors.js';
import * as productService from '../src/services/productService.js';
import * as reservationService from '../src/services/reservationService.js';
import { ReservationState } from '../src/db/schema/reservation.js';

describe('reservationService — reserve', () => {
  beforeEach(truncateAll);

  it('reserves an item when stock is available', async () => {
    await seedProduct('sku-1', 3);

    const reservation = await reservationService.reserve({
      productId: 'sku-1',
      userId: 'user-A',
      quantity: 1,
    });

    expect(reservation.state).toBe(ReservationState.ACTIVE);
    expect(reservation.quantity).toBe(1);
    const snapshot = await productService.getAvailability('sku-1');
    expect(snapshot.availableStock).toBe(2);
    expect(snapshot.activeReservations).toBe(1);
  });

  it('rejects a reservation when stock is exhausted', async () => {
    await seedProduct('sku-1', 1);
    await reservationService.reserve({ productId: 'sku-1', userId: 'user-A', quantity: 1 });

    await expect(
      reservationService.reserve({ productId: 'sku-1', userId: 'user-B', quantity: 1 }),
    ).rejects.toBeInstanceOf(InsufficientStockError);
  });

  it('rejects a reservation for a missing product', async () => {
    await expect(
      reservationService.reserve({ productId: 'missing', userId: 'user-A', quantity: 1 }),
    ).rejects.toBeInstanceOf(ProductNotFoundError);
  });

  it('rejects non-positive quantities', async () => {
    await seedProduct('sku-1', 5);
    await expect(
      reservationService.reserve({ productId: 'sku-1', userId: 'user-A', quantity: 0 }),
    ).rejects.toBeInstanceOf(InvalidQuantityError);
    await expect(
      reservationService.reserve({ productId: 'sku-1', userId: 'user-A', quantity: -1 }),
    ).rejects.toBeInstanceOf(InvalidQuantityError);
    await expect(
      reservationService.reserve({ productId: 'sku-1', userId: 'user-A', quantity: 1.5 }),
    ).rejects.toBeInstanceOf(InvalidQuantityError);
  });

  it('allows partial reservations up to the exact remainder', async () => {
    await seedProduct('sku-1', 5);
    await reservationService.reserve({ productId: 'sku-1', userId: 'A', quantity: 3 });
    await reservationService.reserve({ productId: 'sku-1', userId: 'B', quantity: 2 });
    const snapshot = await productService.getAvailability('sku-1');
    expect(snapshot.availableStock).toBe(0);
    await expect(
      reservationService.reserve({ productId: 'sku-1', userId: 'C', quantity: 1 }),
    ).rejects.toBeInstanceOf(InsufficientStockError);
  });
});
