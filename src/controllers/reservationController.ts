import type { Request, Response } from 'express';
import {
  reservationResponse,
  type ReservationIdParams,
  type ReserveBody,
} from '../schemas/reservation.js';
import type { InventoryService } from '../services/inventoryService.js';
import { sendJson } from '../utils/http.js';

export interface ReservationController {
  reserve(req: Request, res: Response): Promise<void>;
  confirm(req: Request, res: Response): Promise<void>;
  cancel(req: Request, res: Response): Promise<void>;
}

export interface ReservationControllerDeps {
  service: InventoryService;
}

/**
 * Thin: request has already been validated by `validate({ body/params })`
 * middleware. Controller wires the domain call and hands the response through
 * `sendJson` (which validates the outgoing shape).
 */
export const createReservationController = (
  deps: ReservationControllerDeps,
): ReservationController => {
  const { service } = deps;
  return {
    async reserve(req, res) {
      const body = req.body as ReserveBody;
      const reservation = await service.reserve(body);
      sendJson(res, reservationResponse, reservation, 201);
    },

    async confirm(req, res) {
      const { id } = req.params as unknown as ReservationIdParams;
      const reservation = await service.confirm(id);
      sendJson(res, reservationResponse, reservation);
    },

    async cancel(req, res) {
      const { id } = req.params as unknown as ReservationIdParams;
      const reservation = await service.cancel(id);
      sendJson(res, reservationResponse, reservation);
    },
  };
};
