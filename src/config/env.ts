import { z } from 'zod';

const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), schema);

const envSchema = z.object({
  PORT: optional(z.coerce.number().int().positive().default(3000)),
  LOG_LEVEL: optional(z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info')),
  NODE_ENV: optional(z.enum(['development', 'production', 'test']).default('development')),

  DATABASE_URL: z.string().url(),

  // Connection pool sizing.
  // max: hard cap on concurrent connections; keep well under Postgres `max_connections`
  //   accounting for every replica of the API. Default 10.
  // idle_timeout: seconds of inactivity before a pool connection is closed. Prevents
  //   leaking idle sockets during quiet periods. Default 30s.
  // max_lifetime: seconds after which a connection is recycled regardless of health.
  //   Guards against long-lived socket weirdness (dead peers, mid-box NAT resets).
  //   Default 30 min.
  // connect_timeout: seconds to wait for a new connection before erroring. Default 5s
  //   — fail fast during outages rather than piling up requests.
  DB_POOL_MAX: optional(z.coerce.number().int().positive().default(10)),
  DB_IDLE_TIMEOUT_S: optional(z.coerce.number().int().nonnegative().default(30)),
  DB_MAX_LIFETIME_S: optional(z.coerce.number().int().nonnegative().default(60 * 30)),
  DB_CONNECT_TIMEOUT_S: optional(z.coerce.number().int().positive().default(5)),

  SWEEPER_INTERVAL_MS: optional(z.coerce.number().int().positive().default(30_000)),
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
