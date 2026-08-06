import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/http/server.js';
import { buildInventorySystem } from '../src/composition.js';

const buildApp = () => {
  const system = buildInventorySystem();
  const app = createApp({ service: system.service, products: system.products });
  return { app, system };
};

describe('HTTP API', () => {
  it('reserves, confirms, and reports availability', async () => {
    const { app } = buildApp();

    await request(app)
      .post('/api/products')
      .send({ id: 'sku-1', name: 'T-Shirt', totalStock: 2 })
      .expect(201);

    const reserved = await request(app)
      .post('/api/reservations')
      .send({ productId: 'sku-1', userId: 'user-A', quantity: 1 })
      .expect(201);

    expect(reserved.body.state).toBe('ACTIVE');

    await request(app).post(`/api/reservations/${reserved.body.id}/confirm`).expect(200);

    const availability = await request(app).get('/api/products/sku-1/availability').expect(200);
    expect(availability.body).toMatchObject({
      totalStock: 2,
      availableStock: 1,
      confirmedSales: 1,
      activeReservations: 0,
    });
  });

  it('returns 409 when stock is insufficient', async () => {
    const { app } = buildApp();
    await request(app).post('/api/products').send({ id: 's', name: 'x', totalStock: 1 });
    await request(app).post('/api/reservations').send({ productId: 's', userId: 'a', quantity: 1 });

    const res = await request(app)
      .post('/api/reservations')
      .send({ productId: 's', userId: 'b', quantity: 1 })
      .expect(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');
  });

  it('returns 400 for validation errors', async () => {
    const { app } = buildApp();
    const res = await request(app)
      .post('/api/reservations')
      .send({ productId: '', userId: 'a', quantity: 0 })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 for unknown reservation', async () => {
    const { app } = buildApp();
    const res = await request(app).post('/api/reservations/nope/confirm').expect(404);
    expect(res.body.error.code).toBe('RESERVATION_NOT_FOUND');
  });
});
