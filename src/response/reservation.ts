import { z } from 'zod';
import { ReservationState } from '../db/schema/reservation.js';

export const reservationResponse = z.object({
  id: z.string(),
  productId: z.string(),
  userId: z.string(),
  quantity: z.number().int().positive(),
  state: z.nativeEnum(ReservationState),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  expiresAt: z.number().int(),
});

export const reservationListResponse = z.array(reservationResponse);
