import { pgEnum } from 'drizzle-orm/pg-core';

export const reservationStateEnum = pgEnum('reservation_state', [
  'ACTIVE',
  'CONFIRMED',
  'CANCELLED',
  'EXPIRED',
]);
