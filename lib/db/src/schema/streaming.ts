import { pgTable, serial, text, timestamp, integer, boolean, numeric, jsonb, primaryKey } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { channelsTable } from "./channels";
import { videosTable } from "./videos";

// Subscriptions: User pays/subscribes to a channel
export const subscriptionsTable = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  channelId: integer("channel_id").notNull().references(() => channelsTable.id, { onDelete: "cascade" }),
  tier: integer("tier").notNull().default(1), // 1, 2, 3
  status: text("status").notNull().default("active"), // active, expired, cancelled
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Emotes: Custom channel or global images for chat
export const emotesTable = pgTable("emotes", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").references(() => channelsTable.id, { onDelete: "cascade" }), // null for global
  code: text("code").notNull(), // e.g., "KryvHype"
  imageUrl: text("image_url").notNull(),
  isGlobal: boolean("is_global").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Clips: User-generated highlights from streams
export const clipsTable = pgTable("clips", {
  id: serial("id").primaryKey(),
  creatorUserId: integer("creator_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  channelId: integer("channel_id").notNull().references(() => channelsTable.id, { onDelete: "cascade" }),
  videoId: integer("video_id").references(() => videosTable.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  muxAssetId: text("mux_asset_id"),
  muxPlaybackId: text("mux_playback_id"),
  viewCount: integer("view_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Moderation: Moderators for a channel
export const moderatorsTable = pgTable("moderators", {
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  channelId: integer("channel_id").notNull().references(() => channelsTable.id, { onDelete: "cascade" }),
  permissions: jsonb("permissions").default({}), // e.g., { canBan: true, canTimeout: true }
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.userId, table.channelId] })
  };
});

// Bans/Blocks: Users banned from specific channels
export const channelBansTable = pgTable("channel_bans", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  channelId: integer("channel_id").notNull().references(() => channelsTable.id, { onDelete: "cascade" }),
  reason: text("reason"),
  expiresAt: timestamp("expires_at", { withTimezone: true }), // null for permanent
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Tips/Donations: Direct support to creators
export const tipsTable = pgTable("tips", {
  id: serial("id").primaryKey(),
  senderUserId: integer("sender_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  receiverChannelId: integer("receiver_channel_id").notNull().references(() => channelsTable.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  message: text("message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
