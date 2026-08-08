import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { InventoryService } from '../services/InventoryService.js';
import type { ProductRepository } from '../repositories/ProductRepository.js';
import { createProduct } from '../domain/Product.js';
import { toHttpError } from './errorMapping.js';
import { HttpErrorCode, HttpStatus } from './httpStatus.js';

const reserveSchema = z
  .object({
    productId: z.string().min(1),
    userId: z.string().min(1),
    quantity: z.number().int().positive(),
  })
  .strict();

const seedProductSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    totalStock: z.number().int().nonnegative(),
  })
  .strict();

export interface RouteDependencies {
  service: InventoryService;
  products: ProductRepository;
}

export function buildRouter(deps: RouteDependencies): Router {
  const router = Router();
  const { service, products } = deps;

  router.post('/products', async (req: Request, res: Response) => {
    const parsed = seedProductSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error.message);
    try {
      const product = createProduct(parsed.data);
      await products.save(product);
      res.status(HttpStatus.CREATED).json(product);
    } catch (err) {
      const { status, body } = toHttpError(err);
      res.status(status).json(body);
    }
  });

  router.get('/products/:id/availability', async (req: Request, res: Response) => {
    try {
      const snapshot = await service.getAvailability(req.params.id!);
      res.status(HttpStatus.OK).json(snapshot);
    } catch (err) {
      const { status, body } = toHttpError(err);
      res.status(status).json(body);
    }
  });

  router.post('/reservations', async (req: Request, res: Response) => {
    const parsed = reserveSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error.message);
    try {
      const reservation = await service.reserve(parsed.data);
      res.status(HttpStatus.CREATED).json(reservation);
    } catch (err) {
      const { status, body } = toHttpError(err);
      res.status(status).json(body);
    }
  });

  router.post('/reservations/:id/confirm', async (req: Request, res: Response) => {
    try {
      const reservation = await service.confirm(req.params.id!);
      res.status(HttpStatus.OK).json(reservation);
    } catch (err) {
      const { status, body } = toHttpError(err);
      res.status(status).json(body);
    }
  });

  router.post('/reservations/:id/cancel', async (req: Request, res: Response) => {
    try {
      const reservation = await service.cancel(req.params.id!);
      res.status(HttpStatus.OK).json(reservation);
    } catch (err) {
      const { status, body } = toHttpError(err);
      res.status(status).json(body);
    }
  });

  return router;
}

function badRequest(res: Response, message: string): void {
  res
    .status(HttpStatus.BAD_REQUEST)
    .json({ error: { code: HttpErrorCode.VALIDATION_ERROR, message } });
}
