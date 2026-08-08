const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;

const HOLD_DURATION_MINUTES = 2;
const SWEEPER_INTERVAL_SECONDS = 30;
const DB_IDLE_TIMEOUT_SECONDS = 30;
const DB_MAX_LIFETIME_MINUTES = 30;
const DB_CONNECT_TIMEOUT_SECONDS = 5;
const DB_CLOSE_TIMEOUT_SECONDS = 5;

/** Default hold duration for a fresh reservation: 2 minutes (per challenge spec). */
export const DEFAULT_HOLD_DURATION_MS = HOLD_DURATION_MINUTES * SECONDS_PER_MINUTE * MS_PER_SECOND;

/** HTTP */
export const DEFAULT_HTTP_PORT = 3000;

/** Background sweeper cadence */
export const DEFAULT_SWEEPER_INTERVAL_MS = SWEEPER_INTERVAL_SECONDS * MS_PER_SECOND;

/** Postgres connection pool defaults. Tuned for a small API replica; override via env. */
export const DEFAULT_DB_POOL_MAX = 10;
export const DEFAULT_DB_IDLE_TIMEOUT_S = DB_IDLE_TIMEOUT_SECONDS;
export const DEFAULT_DB_MAX_LIFETIME_S = DB_MAX_LIFETIME_MINUTES * SECONDS_PER_MINUTE;
export const DEFAULT_DB_CONNECT_TIMEOUT_S = DB_CONNECT_TIMEOUT_SECONDS;

/** Seconds granted to in-flight queries when the pool is asked to close. */
export const DB_CLOSE_TIMEOUT_S = DB_CLOSE_TIMEOUT_SECONDS;
