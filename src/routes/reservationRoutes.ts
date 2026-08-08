import { Router } from 'express';
import type { ReservationController } from '../controllers/reservationController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { reservationIdParams, reserveBody } from '../schemas/reservation.js';

export const reservationRoutes = (controller: ReservationController): Router => {
  const router = Router();
  router.post(
    '/',
    validate({ body: reserveBody }),
    asyncHandler((req, res) => controller.reserve(req, res)),
  );
  router.post(
    '/:id/confirm',
    validate({ params: reservationIdParams }),
    asyncHandler((req, res) => controller.confirm(req, res)),
  );
  router.post(
    '/:id/cancel',
    validate({ params: reservationIdParams }),
    asyncHandler((req, res) => controller.cancel(req, res)),
  );
  return router;
};
