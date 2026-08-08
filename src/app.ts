import express, { type Express } from 'express';
import { loadEnv } from './config/env.js';
import { initDatabase } from './db/db.js';
import { asyncHandler } from './middleware/asyncHandler.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestId } from './middleware/requestId.js';
import { requestLogger } from './middleware/requestLogger.js';
import { apiRoutes } from './routes/index.js';

const env = loadEnv();
initDatabase(env.DATABASE_URL, {
  maxConnections: env.DB_POOL_MAX,
  idleTimeoutSeconds: env.DB_IDLE_TIMEOUT_S,
  maxLifetimeSeconds: env.DB_MAX_LIFETIME_S,
  connectTimeoutSeconds: env.DB_CONNECT_TIMEOUT_S,
});

const app: Express = express();

app.use(requestId);
app.use(requestLogger);
app.use(express.json());

app.get('/health', asyncHandler(async (_req, res) => { res.json({ status: 'ok' }); }));
app.use('/api', apiRoutes());

app.use(errorHandler);

export { app };
export default app;
