import 'dotenv/config';
import { loadEnv } from './config/env.js';
import { startServer } from './server.js';

// Fail fast if any required env var is missing/malformed.
loadEnv();

startServer().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('failed to start server', err);
  process.exit(1);
});
