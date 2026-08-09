import type { ReserveBody } from '../request/reservation.js';
import * as reservationService from '../services/reservationService.js';
import type { Reservation } from '../types/reservation.js';

export async function reserve(body: ReserveBody): Promise<Reservation> {
  return reservationService.reserve(body);
}

export async function confirm(id: string): Promise<Reservation> {
  return reservationService.confirm(id);
}

export async function cancel(id: string): Promise<Reservation> {
  return reservationService.cancel(id);
}

export async function list(): Promise<Reservation[]> {
  return reservationService.list();
}
