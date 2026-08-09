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

export const updateProductBody = z
  .object({
    name: z.string().min(1).optional(),
    totalStock: z.number().int().nonnegative().optional(),
  })
  .strict()
  .refine((v) => v.name !== undefined || v.totalStock !== undefined, {
    message: 'At least one of `name` or `totalStock` must be provided',
  });

export type CreateProductBody = z.infer<typeof createProductBody>;
export type ProductIdParams = z.infer<typeof productIdParams>;
export type UpdateProductBody = z.infer<typeof updateProductBody>;
