import type { Request, Response } from 'express';
import { createProduct } from '../domain/product.js';
import * as productRepo from '../repositories/productRepository.js';
import {
  availabilityResponse,
  productResponse,
  type CreateProductBody,
  type ProductIdParams,
} from '../schemas/product.js';
import * as inventoryService from '../services/inventoryService.js';
import type { InventoryServiceDeps } from '../services/inventoryService.js';
import { sendJson } from '../utils/http.js';

export interface ProductControllerDeps {
  service: InventoryServiceDeps;
  products: typeof productRepo;
}

type Handler = (req: Request, res: Response) => Promise<void>;

export function create(deps: ProductControllerDeps): Handler {
  return async (req, res) => {
    const body = req.body as CreateProductBody;
    const product = createProduct(body);
    await deps.products.save(product);
    sendJson(res, productResponse, product, 201);
  };
}

export function getAvailability(deps: ProductControllerDeps): Handler {
  return async (req, res) => {
    const { id } = req.params as unknown as ProductIdParams;
    const snapshot = await inventoryService.getAvailability(deps.service, id);
    sendJson(res, availabilityResponse, snapshot);
  };
}
