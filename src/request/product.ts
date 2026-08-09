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

export type CreateProductBody = z.infer<typeof createProductBody>;
export type ProductIdParams = z.infer<typeof productIdParams>;
