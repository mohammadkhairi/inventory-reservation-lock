import type { CreateProductBody, UpdateProductBody } from '../request/product.js';
import * as productService from '../services/productService.js';
import type { Product } from '../types/product.js';
import type { AvailabilitySnapshot } from '../types/reservation.js';

export async function create(body: CreateProductBody): Promise<Product> {
  return productService.create(body);
}

export async function list(): Promise<Product[]> {
  return productService.list();
}

export async function update(params: {
  productId: string;
  patch: UpdateProductBody;
}): Promise<Product> {
  return productService.update(params);
}

export async function getAvailability(id: string): Promise<AvailabilitySnapshot> {
  return productService.getAvailability(id);
}
