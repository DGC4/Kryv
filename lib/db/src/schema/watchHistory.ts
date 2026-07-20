import { pgTable, serial, text, timestamp, integer, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { videosTable } from "./videos";

export const watchHistoryTable = pgTable("watch_history", {
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  videoId: integer("video_id").notNull().references(() => videosTable.id, { onDelete: "cascade" }),
  watchedAt: timestamp("watched_at", { withTimezone: true }).notNull().defaultNow(),
  progressSeconds: integer("progress_seconds").notNull().default(0),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.userId, table.videoId] })
  };
});

export const insertWatchHistorySchema = createInsertSchema(watchHistoryTable);
export type InsertWatchHistory = z.infer<typeof insertWatchHistorySchema>;
export type WatchHistory = typeof watchHistoryTable.$inferSelect;
