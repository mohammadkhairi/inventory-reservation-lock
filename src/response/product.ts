import { z } from 'zod';

export const productResponse = z.object({
  id: z.string(),
  name: z.string(),
  totalStock: z.number().int().nonnegative(),
});

export const productListResponse = z.array(productResponse);

export const availabilityResponse = z.object({
  productId: z.string(),
  totalStock: z.number().int().nonnegative(),
  activeReservations: z.number().int().nonnegative(),
  confirmedSales: z.number().int().nonnegative(),
  availableStock: z.number().int().nonnegative(),
});
