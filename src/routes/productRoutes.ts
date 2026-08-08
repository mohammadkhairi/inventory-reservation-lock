import { Router } from 'express';
import type { ProductController } from '../controllers/productController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { createProductBody, productIdParams } from '../schemas/product.js';

export const productRoutes = (controller: ProductController): Router => {
  const router = Router();
  router.post(
    '/',
    validate({ body: createProductBody }),
    asyncHandler((req, res) => controller.create(req, res)),
  );
  router.get(
    '/:id/availability',
    validate({ params: productIdParams }),
    asyncHandler((req, res) => controller.getAvailability(req, res)),
  );
  return router;
};
