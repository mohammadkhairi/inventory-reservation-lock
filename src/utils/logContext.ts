import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export interface LogContext {
  /** Correlation ID for an HTTP request. */
  requestId?: string;
  /** Correlation ID for a background job / cron / script run. */
  sessionId?: string;
  /** Free-form tag for what the session is doing (e.g. 'db-migrate', 'seed-products'). */
  session?: string;
}

const store = new AsyncLocalStorage<LogContext>();

export function runInLogContext<T>(ctx: LogContext, fn: () => Promise<T> | T): Promise<T> | T {
  return store.run(ctx, fn);
}

/** Read the current context (empty object if none set). */
export function currentLogContext(): LogContext {
  return store.getStore() ?? {};
}

/**
 * Wraps a background job in a fresh log context so every log line inside
 * carries the same `sessionId`. Use in scripts, cron jobs, or any non-HTTP
 * entry point that needs correlated logs.
 */
export function runWithSession<T>(session: string, fn: () => Promise<T> | T): Promise<T> | T {
  return runInLogContext({ sessionId: randomUUID(), session }, fn);
}
