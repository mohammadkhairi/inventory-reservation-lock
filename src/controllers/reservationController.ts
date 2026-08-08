import type { Request, Response } from 'express';
import {
  reservationResponse,
  type ReservationIdParams,
  type ReserveBody,
} from '../schemas/reservation.js';
import * as inventoryService from '../services/inventoryService.js';
import type { InventoryServiceDeps } from '../services/inventoryService.js';
import { sendJson } from '../utils/http.js';

export interface ReservationControllerDeps {
  service: InventoryServiceDeps;
}

type Handler = (req: Request, res: Response) => Promise<void>;

export function reserve(deps: ReservationControllerDeps): Handler {
  return async (req, res) => {
    const body = req.body as ReserveBody;
    const reservation = await inventoryService.reserve(deps.service, body);
    sendJson(res, reservationResponse, reservation, 201);
  };
}

export function confirm(deps: ReservationControllerDeps): Handler {
  return async (req, res) => {
    const { id } = req.params as unknown as ReservationIdParams;
    const reservation = await inventoryService.confirm(deps.service, id);
    sendJson(res, reservationResponse, reservation);
  };
}

export function cancel(deps: ReservationControllerDeps): Handler {
  return async (req, res) => {
    const { id } = req.params as unknown as ReservationIdParams;
    const reservation = await inventoryService.cancel(deps.service, id);
    sendJson(res, reservationResponse, reservation);
  };
}
