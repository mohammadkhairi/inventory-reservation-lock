import { pino, type Logger } from 'pino';
import { loadEnv } from '../config/env.js';
import { currentLogContext } from './logContext.js';

const env = loadEnv();

const base = pino({
  level: env.LOG_LEVEL,
  // Every log line automatically gets requestId / sessionId / session tag
  // from the current AsyncLocalStorage context — no per-call plumbing.
  mixin: () => currentLogContext(),
  ...(env.NODE_ENV === 'production'
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'yyyy-mm-dd HH:MM:ss', ignore: 'pid,hostname' },
        },
      }),
});

/**
 * Per-module logger factory. Every call returns a child logger with the
 * `context` tag pre-attached so log lines carry their origin.
 *
 *   const log = createLogger('reservationService');
 *   log.info({ productId }, 'reserved');
 *   log.error({ err }, 'reserve failed');
 *
 * When inside an HTTP request or a `runWithSession(...)` block, log lines
 * also carry `requestId` / `sessionId` automatically for cross-log correlation.
 */
export function createLogger(context: string): Logger {
  return base.child({ context });
}
