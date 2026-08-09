import { InsufficientStockError, ProductNotFoundError } from '../errors.js';
import * as products from '../repositories/productRepository.js';
import * as reservations from '../repositories/reservationRepository.js';
import { computeAvailability } from '../rules/reservationRules.js';
import type { UpdateProductBody } from '../request/product.js';
import type { Product } from '../types/product.js';
import type { AvailabilitySnapshot } from '../types/reservation.js';
import { createLogger } from '../utils/logger.js';
import { locker } from '../utils/locker.js';

const log = createLogger('productService');

export async function create(product: Product): Promise<Product> {
  log.info({ productId: product.id, totalStock: product.totalStock }, 'creating product');
  await products.save(product);
  return product;
}

export async function list(): Promise<Product[]> {
  const rows = await products.findAll();
  log.debug({ count: rows.length }, 'listed products');
  return rows;
}

/**
 * Partial update. Any field left `undefined` in `patch` is unchanged. Runs
 * under the product's advisory lock so a concurrent reserve/confirm can't
 * slip a reservation past the stock-invariant check below.
 *
 * Refuses to shrink `totalStock` below the sum of currently ACTIVE +
 * CONFIRMED reservations — otherwise the availability math would go negative.
 */
export async function update(params: {
  productId: string;
  patch: UpdateProductBody;
}): Promise<Product> {
  const { productId, patch } = params;
  return locker.withLock(productId, async () => {
    const existing = await products.findById(productId);
    if (!existing) {
      log.warn({ productId }, 'product not found');
      throw new ProductNotFoundError(productId);
    }

    if (patch.totalStock !== undefined && patch.totalStock < existing.totalStock) {
      const records = await reservations.findByProductId(productId);
      const view = computeAvailability({
        product: existing,
        reservations: records,
        now: Date.now(),
      });
      const reserved = view.activeReservations + view.confirmedSales;
      if (patch.totalStock < reserved) {
        log.warn(
          { productId, requestedStock: patch.totalStock, currentlyReserved: reserved },
          'cannot reduce stock below currently reserved',
        );
        throw new InsufficientStockError({
          productId,
          available: patch.totalStock,
          requested: reserved,
        });
      }
    }

    const updated: Product = {
      ...existing,
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.totalStock !== undefined && { totalStock: patch.totalStock }),
    };
    await products.save(updated);
    log.info({ productId, patch }, 'product updated');
    return updated;
  });
}

export async function getAvailability(productId: string): Promise<AvailabilitySnapshot> {
  return locker.withLock(productId, async () => {
    const product = await products.findById(productId);
    if (!product) {
      log.warn({ productId }, 'product not found');
      throw new ProductNotFoundError(productId);
    }
    const records = await reservations.findByProductId(productId);
    const snapshot = computeAvailability({ product, reservations: records, now: Date.now() });
    log.debug({ productId, snapshot }, 'availability computed');
    return snapshot;
  });
}
