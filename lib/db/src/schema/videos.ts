import {
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { channelsTable } from "./channels";
import { categoriesTable } from "./categories";

// Powers both Kryv Watch (creator uploads, contentType "upload") and
// Kryv Cinema (curated library, contentType "original") — same on-demand
// playback pipeline (FastPix), differentiated by contentType + artwork.
export const videosTable = pgTable("videos", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id")
    .notNull()
    .references(() => channelsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  thumbnailUrl: text("thumbnail_url"),
  posterUrl: text("poster_url"),
  backdropUrl: text("backdrop_url"),
  categoryId: integer("category_id").references(() => categoriesTable.id, {
    onDelete: "set null",
  }),
  contentType: text("content_type").notNull().default("upload"),
  uploadStatus: text("upload_status").notNull().default("waiting"),
  durationSeconds: integer("duration_seconds"),
  viewCount: integer("view_count").notNull().default(0),
  fastpixUploadId: text("fastpix_upload_id"),
  fastpixAssetId: text("fastpix_asset_id").unique(),
  fastpixPlaybackId: text("fastpix_playback_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => ({
  cinemaCatalogIdx: index("videos_cinema_catalog_idx")
    .on(table.contentType, table.createdAt.desc())
    .where(sql`${table.contentType} = 'original'`),
}));

export const insertVideoSchema = createInsertSchema(videosTable).omit({
  id: true,
  createdAt: true,
});
export type InsertVideo = z.infer<typeof insertVideoSchema>;
export type Video = typeof videosTable.$inferSelect;
