import { SystemClock } from './infrastructure/Clock.js';
import { UuidGenerator } from './infrastructure/IdGenerator.js';
import { KeyedMutex } from './infrastructure/KeyedMutex.js';
import { InMemoryProductRepository } from './repositories/ProductRepository.js';
import { InMemoryReservationRepository } from './repositories/ReservationRepository.js';
import { InventoryService } from './services/InventoryService.js';

/**
 * Wires the default in-memory implementation. Swap any collaborator here to
 * back the system with Redis, Postgres, etc. — the service depends only on
 * the interfaces.
 */
export function buildInventorySystem(options: { holdDurationMs?: number } = {}) {
  const products = new InMemoryProductRepository();
  const reservations = new InMemoryReservationRepository();
  const clock = new SystemClock();
  const idGenerator = new UuidGenerator();
  const mutex = new KeyedMutex();

  const service = new InventoryService({
    products,
    reservations,
    clock,
    idGenerator,
    mutex,
    ...(options.holdDurationMs !== undefined ? { holdDurationMs: options.holdDurationMs } : {}),
  });

  return { products, reservations, clock, idGenerator, mutex, service };
}
