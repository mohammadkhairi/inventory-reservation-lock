import { AsyncLocalStorage } from 'node:async_hooks';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {
  DB_CLOSE_TIMEOUT_S,
  DEFAULT_DB_CONNECT_TIMEOUT_S,
  DEFAULT_DB_IDLE_TIMEOUT_S,
  DEFAULT_DB_MAX_LIFETIME_S,
  DEFAULT_DB_POOL_MAX,
} from '../config/constants.js';
import * as schema from './schema/index.js';

export type Database = PostgresJsDatabase<typeof schema>;

export interface DatabaseHandle {
  db: Database;
  client: postgres.Sql;
  close(): Promise<void>;
}

export interface DatabasePoolOptions {
  /** Hard cap on concurrent connections. Keep well under Postgres `max_connections`. */
  maxConnections?: number;
  /** Seconds of inactivity before a pool connection is closed. */
  idleTimeoutSeconds?: number;
  /** Seconds after which a connection is recycled regardless of health. */
  maxLifetimeSeconds?: number;
  /** Seconds to wait for a new connection before erroring. */
  connectTimeoutSeconds?: number;
}

let handle: DatabaseHandle | null = null;

/**
 * The current transaction, if we're inside one. Populated by `locker.withLock`
 * via `AsyncLocalStorage.run`, so repositories can pick up the tx without
 * having to receive it as a parameter.
 */
const txStore = new AsyncLocalStorage<Database>();

/**
 * Initialize the DB pool. Idempotent — subsequent calls return the existing
 * handle so tests can call it in per-worker setup without stomping the pool.
 *
 * Defaults are conservative for a small API replica; override via env
 * (`DB_POOL_MAX`, `DB_IDLE_TIMEOUT_S`, `DB_MAX_LIFETIME_S`, `DB_CONNECT_TIMEOUT_S`).
 */
export function initDatabase(url: string, opts: DatabasePoolOptions = {}): DatabaseHandle {
  if (handle) return handle;
  const client = postgres(url, {
    max: opts.maxConnections ?? DEFAULT_DB_POOL_MAX,
    idle_timeout: opts.idleTimeoutSeconds ?? DEFAULT_DB_IDLE_TIMEOUT_S,
    max_lifetime: opts.maxLifetimeSeconds ?? DEFAULT_DB_MAX_LIFETIME_S,
    connect_timeout: opts.connectTimeoutSeconds ?? DEFAULT_DB_CONNECT_TIMEOUT_S,
  });
  const drizzleDb = drizzle(client, { schema });
  handle = {
    db: drizzleDb,
    client,
    close: async () => {
      const current = handle;
      handle = null;
      if (current) await current.client.end({ timeout: DB_CLOSE_TIMEOUT_S });
    },
  };
  return handle;
}

/**
 * The Drizzle client to use for a query. Returns the current transaction if
 * we're inside one (`runInTransaction` set it via AsyncLocalStorage), otherwise
 * the base pool. Repositories always call this — no need to plumb `tx` through
 * function signatures.
 */
export function db(): Database {
  const tx = txStore.getStore();
  if (tx) return tx;
  if (!handle) {
    throw new Error('Database not initialized. Call initDatabase(url) at app boot.');
  }
  return handle.db;
}

/**
 * Run `fn` inside the given transaction, making that tx visible to every
 * `db()` call in the async subtree. Used by `locker.withLock`.
 */
export function runInTransaction<T>(tx: Database, fn: () => Promise<T>): Promise<T> {
  return txStore.run(tx, fn);
}

export function getDatabaseHandle(): DatabaseHandle | null {
  return handle;
}

export async function closeDatabase(): Promise<void> {
  if (handle) await handle.close();
}
