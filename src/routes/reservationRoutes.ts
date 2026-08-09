import { Router } from 'express';
import * as reservationController from '../controllers/reservationController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import {
  reservationIdParams,
  reserveBody,
  type ReservationIdParams,
  type ReserveBody,
} from '../request/reservation.js';
import { reservationResponse } from '../response/reservation.js';
import { sendJson } from '../utils/http.js';

export function reservationRoutes(): Router {
  const router = Router();

  router.post(
    '/',
    validate({ body: reserveBody }),
    asyncHandler(async (req, res) => {
      const reservation = await reservationController.reserve(req.body as ReserveBody);
      sendJson(res, reservationResponse, reservation, 201);
    }),
  );

  router.post(
    '/:id/confirm',
    validate({ params: reservationIdParams }),
    asyncHandler(async (req, res) => {
      const { id } = req.params as unknown as ReservationIdParams;
      const reservation = await reservationController.confirm(id);
      sendJson(res, reservationResponse, reservation);
    }),
  );

  router.post(
    '/:id/cancel',
    validate({ params: reservationIdParams }),
    asyncHandler(async (req, res) => {
      const { id } = req.params as unknown as ReservationIdParams;
      const reservation = await reservationController.cancel(id);
      sendJson(res, reservationResponse, reservation);
    }),
  );

  return router;
}
