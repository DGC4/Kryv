import { boolean, index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/** Core user table backing the Manus OAuth flow. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const creatorProfiles = mysqlTable(
  "creator_profiles",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    displayName: varchar("displayName", { length: 60 }).notNull(),
    bio: text("bio"),
    avatarUrl: varchar("avatarUrl", { length: 2048 }),
    brandColor: varchar("brandColor", { length: 16 }).default("#8B5CF6").notNull(),
    channelSlug: varchar("channelSlug", { length: 90 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex("creator_profiles_user_id_unique").on(table.userId),
    uniqueIndex("creator_profiles_channel_slug_unique").on(table.channelSlug),
  ],
);

export const creatorStreamSettings = mysqlTable(
  "creator_stream_settings",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    rtmpServerUrl: varchar("rtmpServerUrl", { length: 512 }),
    streamKeyHash: varchar("streamKeyHash", { length: 128 }),
    streamKeyPreview: varchar("streamKeyPreview", { length: 32 }),
    streamTitle: varchar("streamTitle", { length: 140 }).default("").notNull(),
    category: varchar("category", { length: 80 }),
    isLive: boolean("isLive").default(false).notNull(),
    lastKeyRotatedAt: timestamp("lastKeyRotatedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [uniqueIndex("creator_stream_settings_user_id_unique").on(table.userId)],
);

export const creatorNotificationPreferences = mysqlTable(
  "creator_notification_preferences",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    streamAlerts: boolean("streamAlerts").default(true).notNull(),
    followerAlerts: boolean("followerAlerts").default(true).notNull(),
    revenueAlerts: boolean("revenueAlerts").default(true).notNull(),
    weeklyDigest: boolean("weeklyDigest").default(true).notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [uniqueIndex("creator_notification_preferences_user_id_unique").on(table.userId)],
);

export const streamSessions = mysqlTable(
  "stream_sessions",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 140 }).notNull(),
    startedAt: timestamp("startedAt").notNull(),
    endedAt: timestamp("endedAt"),
    peakViewers: int("peakViewers").default(0).notNull(),
    totalViews: int("totalViews").default(0).notNull(),
    followerGains: int("followerGains").default(0).notNull(),
    revenueCents: int("revenueCents").default(0).notNull(),
  },
  (table) => [index("stream_sessions_user_started_at_index").on(table.userId, table.startedAt)],
);

export const creatorPayouts = mysqlTable(
  "creator_payouts",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    periodLabel: varchar("periodLabel", { length: 80 }).notNull(),
    amountCents: int("amountCents").notNull(),
    status: mysqlEnum("status", ["pending", "paid", "failed"]).default("pending").notNull(),
    paidAt: timestamp("paidAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("creator_payouts_user_created_at_index").on(table.userId, table.createdAt)],
);

export const creatorActivities = mysqlTable(
  "creator_activities",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 64 }).notNull(),
    message: varchar("message", { length: 255 }).notNull(),
    occurredAt: timestamp("occurredAt").defaultNow().notNull(),
  },
  (table) => [index("creator_activities_user_occurred_at_index").on(table.userId, table.occurredAt)],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type CreatorProfile = typeof creatorProfiles.$inferSelect;
export type CreatorStreamSettings = typeof creatorStreamSettings.$inferSelect;
export type CreatorNotificationPreferences = typeof creatorNotificationPreferences.$inferSelect;
export type StreamSession = typeof streamSessions.$inferSelect;
export type CreatorPayout = typeof creatorPayouts.$inferSelect;
export type CreatorActivity = typeof creatorActivities.$inferSelect;
