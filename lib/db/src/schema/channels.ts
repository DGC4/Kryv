import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { usersTable } from "./users";
import { categoriesTable } from "./categories";

export const channelsTable = pgTable("channels", {
  id: serial("id").primaryKey(),
  ownerUserId: integer("owner_user_id")
    .notNull()
    .unique()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  slug: text("slug").notNull().unique(),
  displayName: text("display_name").notNull(),
  description: text("description"),
  avatarUrl: text("avatar_url"),
  bannerUrl: text("banner_url"),
  categoryId: integer("category_id").references(() => categoriesTable.id, {
    onDelete: "set null",
  }),
  streamTitle: text("stream_title"),
  isLive: boolean("is_live").notNull().default(false),
  viewerCount: integer("viewer_count").notNull().default(0),
  // Mux live streaming infrastructure — real RTMP ingest + HLS playback.
  muxLiveStreamId: text("mux_live_stream_id"),
  muxStreamKey: text("mux_stream_key"),
  muxPlaybackId: text("mux_playback_id"),
  // Self-hosted stream key (always available, no Mux required)
  streamKey: text("stream_key"),
  rtmpUrl: text("rtmp_url").default("rtmp://global-live.mux.com:5222/app"),
  streamKeyGeneratedAt: timestamp("stream_key_generated_at", { withTimezone: true }),
  // Stream analytics
  lastStreamAt: timestamp("last_stream_at", { withTimezone: true }),
  totalStreamCount: integer("total_stream_count").notNull().default(0),
  peakViewerCount: integer("peak_viewer_count").notNull().default(0),
  followerCount: integer("follower_count").notNull().default(0),
  subCount: integer("sub_count").notNull().default(0),
  // Channel settings
  language: text("language").default("en"),
  matureContent: boolean("mature_content").notNull().default(false),
  channelPointsEnabled: boolean("channel_points_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertChannelSchema = createInsertSchema(channelsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertChannel = z.infer<typeof insertChannelSchema>;
export type Channel = typeof channelsTable.$inferSelect;
