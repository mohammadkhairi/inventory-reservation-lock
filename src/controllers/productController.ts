import type { Request, Response } from 'express';
import { createProduct } from '../domain/product.js';
import type { ProductRepository } from '../repositories/productRepository.js';
import {
  availabilityResponse,
  productResponse,
  type CreateProductBody,
  type ProductIdParams,
} from '../schemas/product.js';
import type { InventoryService } from '../services/inventoryService.js';
import { sendJson } from '../utils/http.js';

export interface ProductController {
  create(req: Request, res: Response): Promise<void>;
  getAvailability(req: Request, res: Response): Promise<void>;
}

export interface ProductControllerDeps {
  service: InventoryService;
  products: ProductRepository;
}

/**
 * Thin: request has already been validated by `validate({ body/params })`
 * middleware. Controller wires the domain call and hands the response through
 * `sendJson` (which validates the outgoing shape).
 */
export const createProductController = (deps: ProductControllerDeps): ProductController => {
  const { service, products } = deps;
  return {
    async create(req, res) {
      const body = req.body as CreateProductBody;
      const product = createProduct(body);
      await products.save(product);
      sendJson(res, productResponse, product, 201);
    },

    async getAvailability(req, res) {
      const { id } = req.params as unknown as ProductIdParams;
      const snapshot = await service.getAvailability(id);
      sendJson(res, availabilityResponse, snapshot);
    },
  };
};
