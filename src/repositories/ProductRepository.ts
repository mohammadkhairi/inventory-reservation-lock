import { eq } from 'drizzle-orm';
import { db } from '../db/db.js';
import { productInsertSchema, products } from '../db/schema/product.js';
import type { Product } from '../domain/product.js';

export interface ProductRepository {
  findById(id: string): Promise<Product | null>;
  save(product: Product): Promise<void>;
}

/**
 * Factory. Closes over the module-level `db()` helper — when called inside a
 * `locker.withLock` critical section, `db()` returns the current transaction
 * (via AsyncLocalStorage) so writes participate in the advisory-locked tx.
 */
export const productRepository = (): ProductRepository => ({
  async findById(id) {
    const [row] = await db().select().from(products).where(eq(products.id, id)).limit(1);
    return row ?? null;
  },

  async save(product) {
    const value = productInsertSchema.parse(product);
    await db()
      .insert(products)
      .values(value)
      .onConflictDoUpdate({
        target: products.id,
        set: { name: value.name, totalStock: value.totalStock },
      });
  },
});
