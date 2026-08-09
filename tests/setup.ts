import { afterAll } from 'vitest';
import { closeDatabase, initDatabase } from '../src/db/db.js';

/**
 * Per-worker setup. `globalSetup.ts` created the test DB and applied migrations
 * in a separate process — we must re-init the db handle inside each worker so
 * `db()` returns a live client.
 */
const url =
  process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:55432/inventory_test';

initDatabase({ url });

afterAll(async () => {
  await closeDatabase();
});
