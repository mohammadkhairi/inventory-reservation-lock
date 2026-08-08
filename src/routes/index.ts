import { Router } from 'express';
import { SystemClock } from '../infrastructure/clock.js';
import { locker } from '../infrastructure/locker.js';
import * as productRepo from '../repositories/productRepository.js';
import * as reservationRepo from '../repositories/reservationRepository.js';
import type { InventoryServiceDeps } from '../services/inventoryService.js';
import { productRoutes } from './productRoutes.js';
import { reservationRoutes } from './reservationRoutes.js';

/**
 * Composition happens here — app.ts stays free of wiring. All state lives in
 * the DB pool (initialized once at app boot); constructing `service` deps here
 * is a plain object, no side-effects.
 */
export function apiRoutes(): Router {
  const service: InventoryServiceDeps = {
    products: productRepo,
    reservations: reservationRepo,
    locker,
    clock: SystemClock(),
  };

  const router = Router();
  router.use('/products', productRoutes({ service, products: productRepo }));
  router.use('/reservations', reservationRoutes({ service }));
  return router;
}
