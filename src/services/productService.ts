import { ProductNotFoundError } from '../errors.js';
import * as products from '../repositories/productRepository.js';
import * as reservations from '../repositories/reservationRepository.js';
import { computeAvailability } from '../rules/reservationRules.js';
import type { Product } from '../types/product.js';
import type { AvailabilitySnapshot } from '../types/reservation.js';
import { createLogger } from '../utils/logger.js';
import { locker } from '../utils/locker.js';

const log = createLogger('productService');

export async function create(product: Product): Promise<Product> {
  log.info({ id: product.id, totalStock: product.totalStock }, 'creating product');
  await products.save(product);
  return product;
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
