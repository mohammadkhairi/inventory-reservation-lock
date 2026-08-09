import { integer, pgTable, text } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';

export const products = pgTable('products', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  totalStock: integer('total_stock').notNull(),
});

export const productInsertSchema = createInsertSchema(products);
