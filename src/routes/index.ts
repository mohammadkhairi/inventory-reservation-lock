import { Router } from 'express';
import { createProductController } from '../controllers/productController.js';
import { createReservationController } from '../controllers/reservationController.js';
import { SystemClock } from '../infrastructure/clock.js';
import { locker } from '../infrastructure/locker.js';
import { productRepository } from '../repositories/productRepository.js';
import { reservationRepository } from '../repositories/reservationRepository.js';
import { createInventoryService } from '../services/inventoryService.js';
import { productRoutes } from './productRoutes.js';
import { reservationRoutes } from './reservationRoutes.js';

/**
 * Composition happens here — app.ts stays free of wiring. All state lives in
 * the DB pool (initialized once at app boot), so re-building factories inside
 * apiRoutes on each mount is cheap and side-effect-free.
 */
export const apiRoutes = (): Router => {
  const products = productRepository();
  const reservations = reservationRepository();
  const service = createInventoryService({
    products,
    reservations,
    locker,
    clock: SystemClock(),
  });

  const router = Router();
  router.use('/products', productRoutes(createProductController({ service, products })));
  router.use('/reservations', reservationRoutes(createReservationController({ service })));
  return router;
};
