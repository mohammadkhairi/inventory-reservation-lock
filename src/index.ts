import { buildInventorySystem } from './composition.js';
import { createApp } from './http/server.js';

const port = Number(process.env.PORT ?? 3000);
const sweeperMs = Number(process.env.SWEEPER_INTERVAL_MS ?? 30_000);

const system = buildInventorySystem();
const app = createApp({ service: system.service, products: system.products });

// Optional background sweeper. Correctness of `getAvailability` does not depend
// on this — expired holds are treated as expired lazily. The sweeper only
// materializes the transition for audit visibility.
const sweeper = setInterval(() => {
  system.service.sweepExpired().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('sweep failed', err);
  });
}, sweeperMs);
sweeper.unref();

const server = app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`inventory-reservation listening on :${port}`);
});

const shutdown = (signal: string) => {
  // eslint-disable-next-line no-console
  console.log(`received ${signal}, shutting down`);
  clearInterval(sweeper);
  server.close(() => process.exit(0));
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
