import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { channelsTable } from "./channels";
import { usersTable } from "./users";

export const followsTable = pgTable("follows", {
  id: serial("id").primaryKey(),
  followerUserId: text("follower_user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  channelId: integer("channel_id")
    .notNull()
    .references(() => channelsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertFollowSchema = createInsertSchema(followsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertFollow = z.infer<typeof insertFollowSchema>;
export type Follow = typeof followsTable.$inferSelect;
