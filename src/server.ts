import { app } from './app.js';
import { loadEnv } from './config/env.js';
import { closeDatabase } from './db/db.js';
import { createLogger } from './utils/logger.js';

const log = createLogger('server');

export async function startServer(): Promise<void> {
  const env = loadEnv();

  const server = app.listen(env.PORT, () => {
    log.info({ port: env.PORT }, 'listening');
  });

  const shutdown = async (signal: string): Promise<void> => {
    log.info({ signal }, 'shutting down');
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await closeDatabase();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}
