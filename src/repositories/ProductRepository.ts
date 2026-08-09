import { eq } from 'drizzle-orm';
import { db } from '../db/db.js';
import { productInsertSchema, products } from '../db/schema/product.js';
import type { Product } from '../types/product.js';

/**
 * Shape a caller can hold as a `products` value.
 * `import * as products from './productRepository.js'` satisfies this.
 */
export interface ProductRepository {
  findById(id: string): Promise<Product | null>;
  save(product: Product): Promise<void>;
}

export async function findById(id: string): Promise<Product | null> {
  const [row] = await db().select().from(products).where(eq(products.id, id)).limit(1);
  return row ?? null;
}

export async function save(product: Product): Promise<void> {
  const value = productInsertSchema.parse(product);
  await db()
    .insert(products)
    .values(value)
    .onConflictDoUpdate({
      target: products.id,
      set: { name: value.name, totalStock: value.totalStock },
    });
}
