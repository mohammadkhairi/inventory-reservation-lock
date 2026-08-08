import { z } from 'zod';

export const createProductBody = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    totalStock: z.number().int().nonnegative(),
  })
  .strict();

export const productIdParams = z.object({
  id: z.string().min(1),
});

export const productResponse = z.object({
  id: z.string(),
  name: z.string(),
  totalStock: z.number().int().nonnegative(),
});

export const availabilityResponse = z.object({
  productId: z.string(),
  totalStock: z.number().int().nonnegative(),
  activeReservations: z.number().int().nonnegative(),
  confirmedSales: z.number().int().nonnegative(),
  availableStock: z.number().int().nonnegative(),
});

export type CreateProductBody = z.infer<typeof createProductBody>;
export type ProductIdParams = z.infer<typeof productIdParams>;
