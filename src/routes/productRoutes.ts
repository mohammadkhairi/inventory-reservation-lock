import { Router } from 'express';
import * as productController from '../controllers/productController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import {
  createProductBody,
  productIdParams,
  updateProductBody,
  type CreateProductBody,
  type ProductIdParams,
  type UpdateProductBody,
} from '../request/product.js';
import { availabilityResponse, productListResponse, productResponse } from '../response/product.js';
import { sendJson } from '../utils/http.js';

export function productRoutes(): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      const list = await productController.list();
      sendJson({ res, schema: productListResponse, body: list });
    }),
  );

  router.post(
    '/',
    validate({ body: createProductBody }),
    asyncHandler(async (req, res) => {
      const product = await productController.create(req.body as CreateProductBody);
      sendJson({ res, schema: productResponse, body: product, status: 201 });
    }),
  );

  router.patch(
    '/:id',
    validate({ params: productIdParams, body: updateProductBody }),
    asyncHandler(async (req, res) => {
      const { id } = req.params as unknown as ProductIdParams;
      const patch = req.body as UpdateProductBody;
      const updated = await productController.update({ productId: id, patch });
      sendJson({ res, schema: productResponse, body: updated });
    }),
  );

  router.get(
    '/:id/availability',
    validate({ params: productIdParams }),
    asyncHandler(async (req, res) => {
      const { id } = req.params as unknown as ProductIdParams;
      const snapshot = await productController.getAvailability(id);
      sendJson({ res, schema: availabilityResponse, body: snapshot });
    }),
  );

  return router;
}
