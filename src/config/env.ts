import { z } from 'zod';
import {
  DEFAULT_DB_CONNECT_TIMEOUT_S,
  DEFAULT_DB_IDLE_TIMEOUT_S,
  DEFAULT_DB_MAX_LIFETIME_S,
  DEFAULT_DB_POOL_MAX,
  DEFAULT_HTTP_PORT,
  DEFAULT_SWEEPER_INTERVAL_MS,
} from './constants.js';

const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), schema);

const envSchema = z.object({
  PORT: optional(z.coerce.number().int().positive().default(DEFAULT_HTTP_PORT)),
  LOG_LEVEL: optional(z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info')),
  NODE_ENV: optional(z.enum(['development', 'production', 'test']).default('development')),

  DATABASE_URL: z.string().url(),

  // Pool sizing. See src/config/constants.ts for defaults + rationale.
  DB_POOL_MAX: optional(z.coerce.number().int().positive().default(DEFAULT_DB_POOL_MAX)),
  DB_IDLE_TIMEOUT_S: optional(z.coerce.number().int().nonnegative().default(DEFAULT_DB_IDLE_TIMEOUT_S)),
  DB_MAX_LIFETIME_S: optional(z.coerce.number().int().nonnegative().default(DEFAULT_DB_MAX_LIFETIME_S)),
  DB_CONNECT_TIMEOUT_S: optional(z.coerce.number().int().positive().default(DEFAULT_DB_CONNECT_TIMEOUT_S)),

  SWEEPER_INTERVAL_MS: optional(z.coerce.number().int().positive().default(DEFAULT_SWEEPER_INTERVAL_MS)),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/**
 * Parse and validate `process.env` at boot. Fails fast with a readable summary
 * of every problem rather than 500-ing later on a missing var.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  cached = parsed.data;
  return cached;
}

/** Test-only: forget the cached env so the next `loadEnv` re-parses. */
export function __resetEnvForTests(): void {
  cached = null;
}
