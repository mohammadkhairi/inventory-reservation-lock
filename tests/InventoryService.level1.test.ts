import { describe, it, expect } from 'vitest';
import { makeHarness } from './helpers.js';
import { InsufficientStockError, ProductNotFoundError, InvalidQuantityError } from '../src/domain/errors.js';
import { ReservationState } from '../src/domain/ReservationState.js';

describe('Level 1 — basic reservation', () => {
  it('reserves an item when stock is available', async () => {
    const h = await makeHarness();
    await h.seedProduct('sku-1', 3);

    const reservation = await h.service.reserve({
      productId: 'sku-1',
      userId: 'user-A',
      quantity: 1,
    });

    expect(reservation.state).toBe(ReservationState.ACTIVE);
    expect(reservation.quantity).toBe(1);
    const snapshot = await h.service.getAvailability('sku-1');
    expect(snapshot.availableStock).toBe(2);
    expect(snapshot.activeReservations).toBe(1);
  });

  it('rejects a reservation when stock is exhausted', async () => {
    const h = await makeHarness();
    await h.seedProduct('sku-1', 1);

    await h.service.reserve({ productId: 'sku-1', userId: 'user-A', quantity: 1 });

    await expect(
      h.service.reserve({ productId: 'sku-1', userId: 'user-B', quantity: 1 }),
    ).rejects.toBeInstanceOf(InsufficientStockError);
  });

  it('rejects a reservation for a missing product', async () => {
    const h = await makeHarness();
    await expect(
      h.service.reserve({ productId: 'missing', userId: 'user-A', quantity: 1 }),
    ).rejects.toBeInstanceOf(ProductNotFoundError);
  });

  it('rejects non-positive quantities', async () => {
    const h = await makeHarness();
    await h.seedProduct('sku-1', 5);
    await expect(
      h.service.reserve({ productId: 'sku-1', userId: 'user-A', quantity: 0 }),
    ).rejects.toBeInstanceOf(InvalidQuantityError);
    await expect(
      h.service.reserve({ productId: 'sku-1', userId: 'user-A', quantity: -1 }),
    ).rejects.toBeInstanceOf(InvalidQuantityError);
    await expect(
      h.service.reserve({ productId: 'sku-1', userId: 'user-A', quantity: 1.5 }),
    ).rejects.toBeInstanceOf(InvalidQuantityError);
  });

  it('allows partial reservations up to the exact remainder', async () => {
    const h = await makeHarness();
    await h.seedProduct('sku-1', 5);
    await h.service.reserve({ productId: 'sku-1', userId: 'A', quantity: 3 });
    await h.service.reserve({ productId: 'sku-1', userId: 'B', quantity: 2 });
    const snapshot = await h.service.getAvailability('sku-1');
    expect(snapshot.availableStock).toBe(0);
    await expect(
      h.service.reserve({ productId: 'sku-1', userId: 'C', quantity: 1 }),
    ).rejects.toBeInstanceOf(InsufficientStockError);
  });
});
