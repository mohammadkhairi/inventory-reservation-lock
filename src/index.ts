import 'dotenv/config';
import { loadEnv } from './config/env.js';
import { startServer } from './server.js';

// Fail fast if any required env var is missing/malformed.
loadEnv();

startServer().catch((err) => {
  console.error('failed to start server', err);
  process.exit(1);
});
