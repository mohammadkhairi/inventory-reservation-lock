import { sql } from 'drizzle-orm';
import { db } from '../src/db/db.js';
import { createProduct } from '../src/domain/product.js';
import type { AvailabilitySnapshot, Reservation } from '../src/domain/reservation.js';
import { ManualClock, type ManualClock as ManualClockType } from '../src/infrastructure/clock.js';
import { locker } from '../src/infrastructure/locker.js';
import * as productRepo from '../src/repositories/productRepository.js';
import * as reservationRepo from '../src/repositories/reservationRepository.js';
import * as inventoryService from '../src/services/inventoryService.js';
import type {
  InventoryServiceDeps,
  ReserveInput,
} from '../src/services/inventoryService.js';

/** Fixed epoch used as the ManualClock start in tests. Any stable value works;
 * fixing it keeps time-based assertions deterministic. 2023-11-14T22:13:20Z. */
const TEST_EPOCH_MS = 1_700_000_000_000;

/** Convenience wrapper: pre-binds `deps` so tests can call `h.service.reserve(input)`. */
interface BoundService {
  getAvailability(productId: string): Promise<AvailabilitySnapshot>;
  reserve(input: ReserveInput): Promise<Reservation>;
  confirm(id: string): Promise<Reservation>;
  cancel(id: string): Promise<Reservation>;
}

export interface TestHarness {
  service: BoundService;
  clock: ManualClockType;
  products: typeof productRepo;
  reservations: typeof reservationRepo;
  seedProduct(id: string, totalStock: number): Promise<void>;
}

/** Wipes all rows between tests. Cheaper than dropping+re-migrating. */
export async function truncateAll(): Promise<void> {
  await db().execute(sql`TRUNCATE TABLE "reservations", "products" RESTART IDENTITY CASCADE`);
}

export function makeHarness(options: { holdDurationMs?: number } = {}): TestHarness {
  const clock = ManualClock(TEST_EPOCH_MS);
  const deps: InventoryServiceDeps = {
    products: productRepo,
    reservations: reservationRepo,
    locker,
    clock,
    ...(options.holdDurationMs !== undefined ? { holdDurationMs: options.holdDurationMs } : {}),
  };

  const service: BoundService = {
    getAvailability: (id) => inventoryService.getAvailability(deps, id),
    reserve: (input) => inventoryService.reserve(deps, input),
    confirm: (id) => inventoryService.confirm(deps, id),
    cancel: (id) => inventoryService.cancel(deps, id),
  };

  return {
    service,
    clock,
    products: productRepo,
    reservations: reservationRepo,
    seedProduct: (id, totalStock) => productRepo.save(createProduct({ id, name: id, totalStock })),
  };
}
