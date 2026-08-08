import { app } from './app.js';
import { loadEnv } from './config/env.js';
import { closeDatabase } from './db/db.js';
import { SystemClock } from './infrastructure/clock.js';
import { locker } from './infrastructure/locker.js';
import { productRepository } from './repositories/productRepository.js';
import { reservationRepository } from './repositories/reservationRepository.js';
import { createInventoryService } from './services/inventoryService.js';
import { createLogger } from './utils/logger.js';

const log = createLogger('server');

export async function startServer(): Promise<void> {
  const env = loadEnv();

  const sweeperService = createInventoryService({
    products: productRepository(),
    reservations: reservationRepository(),
    locker,
    clock: SystemClock(),
  });

  // Availability correctness never depends on the sweeper; it only materializes
  // ACTIVE→EXPIRED transitions for audit visibility.
  const sweeper = setInterval(() => {
    sweeperService.sweepExpired().catch((err) => log.error({ err }, 'sweep failed'));
  }, env.SWEEPER_INTERVAL_MS);
  sweeper.unref();

  const server = app.listen(env.PORT, () => {
    log.info({ port: env.PORT }, 'listening');
  });

  const shutdown = async (signal: string): Promise<void> => {
    log.info({ signal }, 'shutting down');
    clearInterval(sweeper);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await closeDatabase();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}
