import * as productService from '../services/productService.js';
import type { CreateProductBody } from '../request/product.js';
import type { Product } from '../types/product.js';
import type { AvailabilitySnapshot } from '../types/reservation.js';

export async function create(body: CreateProductBody): Promise<Product> {
  return productService.create(body);
}

export async function list(): Promise<Product[]> {
  return productService.list();
}

export async function getAvailability(id: string): Promise<AvailabilitySnapshot> {
  return productService.getAvailability(id);
}
