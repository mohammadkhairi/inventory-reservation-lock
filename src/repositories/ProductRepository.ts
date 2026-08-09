import { eq } from 'drizzle-orm';
import { db } from '../db/db.js';
import { productInsertSchema, products } from '../db/schema/product.js';
import type { Product } from '../types/product.js';

export async function findById(id: string): Promise<Product | null> {
  const row = await db().query.products.findFirst({ where: eq(products.id, id) });
  return row ?? null;
}

export async function findAll(): Promise<Product[]> {
  return db().query.products.findMany();
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
