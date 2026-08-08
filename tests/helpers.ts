import { sql } from 'drizzle-orm';
import { db } from '../src/db/db.js';
import { createProduct } from '../src/domain/product.js';
import { ManualClock, type ManualClock as ManualClockType } from '../src/infrastructure/clock.js';
import { locker } from '../src/infrastructure/locker.js';
import {
  productRepository,
  type ProductRepository,
} from '../src/repositories/productRepository.js';
import {
  reservationRepository,
  type ReservationRepository,
} from '../src/repositories/reservationRepository.js';
import {
  createInventoryService,
  type InventoryService,
} from '../src/services/inventoryService.js';

export interface TestHarness {
  service: InventoryService;
  clock: ManualClockType;
  products: ProductRepository;
  reservations: ReservationRepository;
  seedProduct(id: string, totalStock: number): Promise<void>;
}

/** Wipes all rows between tests. Cheaper than dropping+re-migrating. */
export async function truncateAll(): Promise<void> {
  await db().execute(sql`TRUNCATE TABLE "reservations", "products" RESTART IDENTITY CASCADE`);
}

export function makeHarness(options: { holdDurationMs?: number } = {}): TestHarness {
  const clock = ManualClock(1_700_000_000_000);
  const products = productRepository();
  const reservations = reservationRepository();
  const service = createInventoryService({
    products,
    reservations,
    locker,
    clock,
    ...(options.holdDurationMs !== undefined ? { holdDurationMs: options.holdDurationMs } : {}),
  });

  return {
    service,
    clock,
    products,
    reservations,
    seedProduct: (id, totalStock) => products.save(createProduct({ id, name: id, totalStock })),
  };
}
