import { Router } from 'express';
import * as reservationController from '../controllers/reservationController.js';
import type { ReservationControllerDeps } from '../controllers/reservationController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { reservationIdParams, reserveBody } from '../schemas/reservation.js';

export function reservationRoutes(deps: ReservationControllerDeps): Router {
  const router = Router();
  router.post(
    '/',
    validate({ body: reserveBody }),
    asyncHandler(reservationController.reserve(deps)),
  );
  router.post(
    '/:id/confirm',
    validate({ params: reservationIdParams }),
    asyncHandler(reservationController.confirm(deps)),
  );
  router.post(
    '/:id/cancel',
    validate({ params: reservationIdParams }),
    asyncHandler(reservationController.cancel(deps)),
  );
  return router;
}
