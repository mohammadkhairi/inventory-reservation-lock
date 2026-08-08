import { Router } from 'express';
import * as productController from '../controllers/productController.js';
import type { ProductControllerDeps } from '../controllers/productController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { createProductBody, productIdParams } from '../schemas/product.js';

export function productRoutes(deps: ProductControllerDeps): Router {
  const router = Router();
  router.post(
    '/',
    validate({ body: createProductBody }),
    asyncHandler(productController.create(deps)),
  );
  router.get(
    '/:id/availability',
    validate({ params: productIdParams }),
    asyncHandler(productController.getAvailability(deps)),
  );
  return router;
}
