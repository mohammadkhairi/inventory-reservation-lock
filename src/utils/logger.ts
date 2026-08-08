import { pino, type Logger as PinoLogger } from 'pino';
import { loadEnv } from '../config/env.js';

const env = loadEnv();

const base = pino({
  level: env.LOG_LEVEL,
  ...(env.NODE_ENV === 'production'
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'yyyy-mm-dd HH:MM:ss', ignore: 'pid,hostname' },
        },
      }),
});

export type Logger = PinoLogger;

/**
 * Per-module logger factory. Every call returns a child logger with the
 * `context` field pre-attached so log lines carry their origin.
 *
 *   const log = createLogger('InventoryService');
 *   log.info({ productId }, 'reserved');
 *   log.error({ err }, 'reserve failed');
 */
export function createLogger(context: string): Logger {
  return base.child({ context });
}
