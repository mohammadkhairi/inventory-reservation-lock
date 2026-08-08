import { integer, pgTable, text } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';

export const products = pgTable('products', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  totalStock: integer('total_stock').notNull(),
});

export type ProductInsert = typeof products.$inferInsert;
export type ProductSelect = typeof products.$inferSelect;

export const productInsertSchema = createInsertSchema(products);
export const productSelectSchema = createSelectSchema(products);
