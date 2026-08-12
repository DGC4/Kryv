import { integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { usersTable } from './users';

export const userActivityPresenceTable = pgTable('user_activity_presence', {
  userId: integer('user_id').primaryKey().references(() => usersTable.id, { onDelete: 'cascade' }),
  routeKey: text('route_key').notNull(),
  deviceClass: text('device_class').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
