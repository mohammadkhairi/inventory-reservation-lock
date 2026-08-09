import 'dotenv/config';
import { closeDatabase, getDatabaseHandle, initDatabase } from '../src/db/db.js';
import { runMigrations } from '../src/db/migrate.js';
import { runWithSession } from '../src/utils/logContext.js';
import { createLogger } from '../src/utils/logger.js';

const log = createLogger('db-migrate');

const url = process.env.DATABASE_URL;
if (!url) {
  log.error('DATABASE_URL is required');
  process.exit(1);
}

initDatabase(url);
await runWithSession('db-migrate', async () => {
  try {
    const handle = getDatabaseHandle();
    if (!handle) {
      log.error('database not initialized');
      throw new Error('Database not initialized');
    }
    log.info('applying migrations');
    await runMigrations(handle.db);
    log.info('migrations applied');
  } catch (err) {
    log.error({ err }, 'migration failed');
    throw err;
  } finally {
    await closeDatabase();
  }
});
