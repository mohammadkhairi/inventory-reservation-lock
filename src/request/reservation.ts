import { z } from 'zod';

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

export type ReserveBody = z.infer<typeof reserveBody>;
export type ReservationIdParams = z.infer<typeof reservationIdParams>;
