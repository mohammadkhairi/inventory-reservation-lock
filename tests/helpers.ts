import { ManualClock } from '../src/infrastructure/Clock.js';
import { SequentialIdGenerator } from '../src/infrastructure/IdGenerator.js';
import { KeyedMutex } from '../src/infrastructure/KeyedMutex.js';
import { InMemoryProductRepository } from '../src/repositories/ProductRepository.js';
import { InMemoryReservationRepository } from '../src/repositories/ReservationRepository.js';
import { InventoryService } from '../src/services/InventoryService.js';
import { createProduct } from '../src/domain/Product.js';

export interface TestHarness {
  service: InventoryService;
  clock: ManualClock;
  products: InMemoryProductRepository;
  reservations: InMemoryReservationRepository;
  mutex: KeyedMutex;
  seedProduct: (id: string, totalStock: number) => Promise<void>;
}

export async function makeHarness(options: { holdDurationMs?: number } = {}): Promise<TestHarness> {
  const clock = new ManualClock(1_700_000_000_000);
  const products = new InMemoryProductRepository();
  const reservations = new InMemoryReservationRepository();
  const mutex = new KeyedMutex();
  const idGenerator = new SequentialIdGenerator('res');

  const service = new InventoryService({
    products,
    reservations,
    clock,
    idGenerator,
    mutex,
    ...(options.holdDurationMs !== undefined ? { holdDurationMs: options.holdDurationMs } : {}),
  });

  const seedProduct = async (id: string, totalStock: number): Promise<void> => {
    await products.save(createProduct({ id, name: id, totalStock }));
  };

  return { service, clock, products, reservations, mutex, seedProduct };
}
