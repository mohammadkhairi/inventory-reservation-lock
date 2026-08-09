import { Router } from 'express';
import * as productController from '../controllers/productController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import {
  createProductBody,
  productIdParams,
  type CreateProductBody,
  type ProductIdParams,
} from '../request/product.js';
import { availabilityResponse, productResponse } from '../response/product.js';
import { sendJson } from '../utils/http.js';

export function productRoutes(): Router {
  const router = Router();

  router.post(
    '/',
    validate({ body: createProductBody }),
    asyncHandler(async (req, res) => {
      const product = await productController.create(req.body as CreateProductBody);
      sendJson(res, productResponse, product, 201);
    }),
  );

  router.get(
    '/:id/availability',
    validate({ params: productIdParams }),
    asyncHandler(async (req, res) => {
      const { id } = req.params as unknown as ProductIdParams;
      const snapshot = await productController.getAvailability(id);
      sendJson(res, availabilityResponse, snapshot);
    }),
  );

  return router;
}
