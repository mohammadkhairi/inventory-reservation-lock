import express, { type Express } from 'express';
import { buildRouter, type RouteDependencies } from './routes.js';

export function createApp(deps: RouteDependencies): Express {
  const app = express();
  app.use(express.json());
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api', buildRouter(deps));
  return app;
}
