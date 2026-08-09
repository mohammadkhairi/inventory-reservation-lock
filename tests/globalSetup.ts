import postgres from 'postgres';
import { closeDatabase, initDatabase } from '../src/db/db.js';
import { runMigrations } from '../src/db/migrate.js';

/**
 * Vitest globalSetup — runs once before the test suite.
 *
 * Ensures a scratch `inventory_test` database exists on the docker-compose
 * Postgres and applies migrations. Tests truncate between cases (see helpers.ts).
 *
 * TEST_DATABASE_URL overrides the default. The default assumes `npm run db:up`
 * has been run.
 */
const DEFAULT_TEST_URL = 'postgres://postgres:postgres@localhost:55432/inventory_test';
const ADMIN_URL = 'postgres://postgres:postgres@localhost:55432/postgres';

export default async function setup(): Promise<() => Promise<void>> {
  const url = process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_URL;
  process.env.TEST_DATABASE_URL = url;
  process.env.DATABASE_URL = url;

  const dbName = new URL(url).pathname.replace(/^\//, '');
  const admin = postgres(ADMIN_URL, { max: 1 });
  try {
    const rows = await admin`SELECT 1 FROM pg_database WHERE datname = ${dbName}`;
    if (rows.length === 0) {
      await admin.unsafe(`CREATE DATABASE "${dbName}"`);
    }
  } finally {
    await admin.end({ timeout: 5 });
  }

  const handle = initDatabase(url);
  await runMigrations(handle.db);

  return async () => {
    await closeDatabase();
  };
}
