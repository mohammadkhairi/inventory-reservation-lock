import { bigint, index, integer, pgTable, text } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { reservationStateEnum } from './enums.js';
import { products } from './product.js';

export const reservations = pgTable(
  'reservations',
  {
    id: text('id').primaryKey(),
    productId: text('product_id')
      .notNull()
      .references(() => products.id),
    userId: text('user_id').notNull(),
    quantity: integer('quantity').notNull(),
    state: reservationStateEnum('state').notNull(),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
    updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
    expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
  },
  (t) => ({
    byProductId: index('reservations_product_id_idx').on(t.productId),
  }),
);

export type ReservationInsert = typeof reservations.$inferInsert;
export type ReservationSelect = typeof reservations.$inferSelect;

export const reservationInsertSchema = createInsertSchema(reservations);
export const reservationSelectSchema = createSelectSchema(reservations);
