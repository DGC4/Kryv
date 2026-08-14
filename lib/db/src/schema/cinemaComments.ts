import { index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { cinemaTitlesTable } from "./platform";
import { usersTable } from "./users";

// Public discussion for published, owner-curated Cinema titles. This table never
// grants publication or asset-management rights; it only records viewer comments.
export const cinemaCommentsTable = pgTable("cinema_comments", {
  id: serial("id").primaryKey(),
  cinemaTitleId: integer("cinema_title_id").notNull().references(() => cinemaTitlesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  // Reply validity is enforced by the route against the same published title.
  // A nullable scalar avoids a circular schema reference while preserving the
  // shallow reply model and efficient title discussion reads.
  parentCommentId: integer("parent_comment_id"),
  message: text("message").notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletedByUserId: integer("deleted_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  titleParentCreatedIdx: index("cinema_comments_title_parent_created_idx").on(table.cinemaTitleId, table.parentCommentId, table.createdAt.desc(), table.id.desc()),
  userCreatedIdx: index("cinema_comments_user_created_idx").on(table.userId, table.createdAt.desc(), table.id.desc()),
}));

export type CinemaComment = typeof cinemaCommentsTable.$inferSelect;
