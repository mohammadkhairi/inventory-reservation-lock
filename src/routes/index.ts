import { Router } from 'express';
import { productRoutes } from './productRoutes.js';
import { reservationRoutes } from './reservationRoutes.js';

export function apiRoutes(): Router {
  const router = Router();
  router.use('/products', productRoutes());
  router.use('/reservations', reservationRoutes());
  return router;
}
