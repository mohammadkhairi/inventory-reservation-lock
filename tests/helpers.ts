import { sql } from 'drizzle-orm';
import { db } from '../src/db/db.js';
import * as products from '../src/repositories/productRepository.js';

/** Wipes all rows between tests. Cheaper than dropping+re-migrating. */
export async function truncateAll(): Promise<void> {
  await db().execute(sql`TRUNCATE TABLE "reservations", "products" RESTART IDENTITY CASCADE`);
}

export async function seedProduct(id: string, totalStock: number): Promise<void> {
  await products.save({ id, name: id, totalStock });
}
