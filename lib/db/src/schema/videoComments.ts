import { index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { videosTable } from "./videos";
import { channelsTable } from "./channels";
import { usersTable } from "./users";

/**
 * Public discussion attached to a ready Kryv Watch release. Comments remain in
 * the primary transactional database because moderation, ownership checks, and
 * publication visibility are authoritative application concerns.
 */
export const videoCommentsTable = pgTable("video_comments", {
  id: serial("id").primaryKey(),
  videoId: integer("video_id")
    .notNull()
    .references(() => videosTable.id, { onDelete: "cascade" }),
  channelId: integer("channel_id")
    .notNull()
    .references(() => channelsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  // Parent validity is enforced in the route against the same video. Keeping
  // this nullable field avoids a circular schema dependency while preserving
  // reply grouping and efficient page reads.
  parentCommentId: integer("parent_comment_id"),
  message: text("message").notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletedByUserId: integer("deleted_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => ({
  videoParentCreatedIdx: index("video_comments_video_parent_created_idx").on(table.videoId, table.parentCommentId, table.createdAt.desc(), table.id.desc()),
  channelCreatedIdx: index("video_comments_channel_created_idx").on(table.channelId, table.createdAt.desc(), table.id.desc()),
}));

export type VideoComment = typeof videoCommentsTable.$inferSelect;
