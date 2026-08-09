import { sql } from 'drizzle-orm';
import { getDatabaseHandle, runInTransaction } from '../db/db.js';

/**
 * "Give me exclusive access to `key` for the duration of `fn`."
 *
 * Opens a transaction, takes an xact-scoped advisory lock keyed by `key`, and
 * sets the tx as current via AsyncLocalStorage so repositories inside `fn`
 * transparently use it via `db()`. Lock is released at COMMIT/ROLLBACK, so a
 * crashed process can never leak it.
 */
export const locker = {
  async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const handle = getDatabaseHandle();
    if (!handle) throw new Error('Database not initialized. Call initDatabase() first.');
    return handle.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${key}))`);
      return runInTransaction(tx, fn);
    });
  },
};
