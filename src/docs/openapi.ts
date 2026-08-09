import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import {
  createProductBody,
  productIdParams,
} from '../request/product.js';
import {
  reservationIdParams,
  reserveBody,
} from '../request/reservation.js';
import { availabilityResponse, productResponse } from '../response/product.js';
import { reservationResponse } from '../response/reservation.js';

// Adds `.openapi()` to every zod schema (idempotent).
extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

// Reusable schema components (kept in sync with the zod schemas via registry).
registry.register('CreateProductBody', createProductBody);
registry.register('Product', productResponse);
registry.register('Availability', availabilityResponse);
registry.register('ReserveBody', reserveBody);
registry.register('Reservation', reservationResponse);

const jsonBody = <S extends z.ZodTypeAny>(schema: S) => ({
  content: { 'application/json': { schema } },
});

registry.registerPath({
  method: 'post',
  path: '/api/products',
  tags: ['products'],
  summary: 'Seed a product',
  request: { body: jsonBody(createProductBody) },
  responses: {
    201: { description: 'Product created', ...jsonBody(productResponse) },
    400: { description: 'Validation error' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/products/{id}/availability',
  tags: ['products'],
  summary: 'Get a product availability snapshot',
  request: { params: productIdParams },
  responses: {
    200: { description: 'Availability snapshot', ...jsonBody(availabilityResponse) },
    404: { description: 'Product not found' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/reservations',
  tags: ['reservations'],
  summary: 'Create a reservation (2-minute hold)',
  request: { body: jsonBody(reserveBody) },
  responses: {
    201: { description: 'Reservation created', ...jsonBody(reservationResponse) },
    400: { description: 'Validation error' },
    404: { description: 'Product not found' },
    409: { description: 'Insufficient stock' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/reservations/{id}/confirm',
  tags: ['reservations'],
  summary: 'Confirm a reservation (permanent purchase)',
  request: { params: reservationIdParams },
  responses: {
    200: { description: 'Confirmed', ...jsonBody(reservationResponse) },
    404: { description: 'Reservation not found' },
    409: { description: 'Invalid reservation state' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/reservations/{id}/cancel',
  tags: ['reservations'],
  summary: 'Cancel a reservation',
  request: { params: reservationIdParams },
  responses: {
    200: { description: 'Cancelled', ...jsonBody(reservationResponse) },
    404: { description: 'Reservation not found' },
    409: { description: 'Invalid reservation state' },
  },
});

const generator = new OpenApiGeneratorV31(registry.definitions);

export const openApiDocument = generator.generateDocument({
  openapi: '3.1.0',
  info: {
    title: 'Inventory Reservation API',
    version: '1.0.0',
    description:
      'Inventory reservation system that prevents overselling via Postgres advisory locks.',
  },
  servers: [{ url: 'http://localhost:3000', description: 'Local' }],
});
