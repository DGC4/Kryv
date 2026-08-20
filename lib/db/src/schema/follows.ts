import { index, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { channelsTable } from "./channels";
import { usersTable } from "./users";

export const followsTable = pgTable("follows", {
  id: serial("id").primaryKey(),
  followerUserId: integer("follower_user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  channelId: integer("channel_id")
    .notNull()
    .references(() => channelsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => ({
  followerChannelUnique: uniqueIndex("follows_follower_channel_unique").on(table.followerUserId, table.channelId),
  followerCreatedIdx: index("follows_follower_created_idx").on(table.followerUserId, table.createdAt.desc()),
  channelFanoutIdx: index("follows_channel_id_idx").on(table.channelId, table.id),
}));

export const insertFollowSchema = createInsertSchema(followsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertFollow = z.infer<typeof insertFollowSchema>;
export type Follow = typeof followsTable.$inferSelect;
