import { z } from 'zod';
import { ReservationState } from '../domain/reservation.js';

export const reserveBody = z
  .object({
    productId: z.string().min(1),
    userId: z.string().min(1),
    quantity: z.number().int().positive(),
  })
  .strict();

export const reservationIdParams = z.object({
  id: z.string().min(1),
});

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

export type ReserveBody = z.infer<typeof reserveBody>;
export type ReservationIdParams = z.infer<typeof reservationIdParams>;
