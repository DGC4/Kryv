import { index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { channelsTable } from "./channels";
import { usersTable } from "./users";

export const chatMessagesTable = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id")
    .notNull()
    .references(() => channelsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletedByUserId: integer("deleted_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => ({
  channelCreatedIdx: index("chat_messages_channel_created_idx").on(table.channelId, table.createdAt.desc(), table.id.desc()),
}));

export const insertChatMessageSchema = createInsertSchema(
  chatMessagesTable,
).omit({ id: true, createdAt: true, deletedAt: true, deletedByUserId: true });
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessagesTable.$inferSelect;
