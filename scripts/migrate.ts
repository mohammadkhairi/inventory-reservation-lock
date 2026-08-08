import 'dotenv/config';
import { closeDatabase, getDatabaseHandle, initDatabase } from '../src/db/db.js';
import { runMigrations } from '../src/db/migrate.js';

const url = process.env.DATABASE_URL;
if (!url) {
  // eslint-disable-next-line no-console
  console.error('DATABASE_URL is required');
  process.exit(1);
}

initDatabase(url);
try {
  const handle = getDatabaseHandle();
  if (!handle) throw new Error('Database not initialized');
  await runMigrations(handle.db);
  // eslint-disable-next-line no-console
  console.log('migrations applied');
} finally {
  await closeDatabase();
}
