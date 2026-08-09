import { ProductNotFoundError } from '../errors.js';
import * as products from '../repositories/productRepository.js';
import * as reservations from '../repositories/reservationRepository.js';
import { computeAvailability } from '../rules/reservationRules.js';
import type { Product } from '../types/product.js';
import type { AvailabilitySnapshot } from '../types/reservation.js';
import { locker } from '../utils/locker.js';

export async function create(product: Product): Promise<Product> {
  await products.save(product);
  return product;
}

export async function getAvailability(productId: string): Promise<AvailabilitySnapshot> {
  return locker.withLock(productId, async () => {
    const product = await products.findById(productId);
    if (!product) throw new ProductNotFoundError(productId);
    const records = await reservations.findByProductId(productId);
    return computeAvailability(product, records, Date.now());
  });
}
