import 'dotenv/config';
import { closeDatabase, initDatabase } from '../src/db/db.js';
import * as products from '../src/repositories/productRepository.js';
import type { Product } from '../src/types/product.js';

/**
 * Seeds a handful of products covering the flash-sale test scenarios:
 * - `flash-sku` — stock=1, the classic overselling test target.
 * - `bulk-sku` — stock=25, N-of-500 concurrency test target.
 * - `tshirt` / `hoodie` — stock=10 each, humane end-to-end demo via Swagger.
 *
 * Idempotent — `products.save` upserts on the primary key, so running this
 * repeatedly refreshes the stock levels rather than duplicating rows.
 */
const SEED_PRODUCTS: Product[] = [
  { id: 'flash-sku', name: 'Flash Sale Item', totalStock: 1 },
  { id: 'bulk-sku', name: 'Bulk Item', totalStock: 25 },
  { id: 'tshirt', name: 'T-Shirt', totalStock: 10 },
  { id: 'hoodie', name: 'Hoodie', totalStock: 10 },
];

const url = process.env.DATABASE_URL;
if (!url) {
  // eslint-disable-next-line no-console
  console.error('DATABASE_URL is required');
  process.exit(1);
}

initDatabase(url);
try {
  for (const product of SEED_PRODUCTS) {
    await products.save(product);
    // eslint-disable-next-line no-console
    console.log(`seeded ${product.id} (stock=${product.totalStock})`);
  }
} finally {
  await closeDatabase();
}
