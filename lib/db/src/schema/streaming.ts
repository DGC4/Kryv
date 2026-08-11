import { index, pgTable, serial, text, timestamp, integer, boolean, numeric, jsonb, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./users";
import { channelsTable } from "./channels";
import { videosTable } from "./videos";
import { categoriesTable } from "./categories";

// ─── Subscriptions ────────────────────────────────────────────────────────────
export const subscriptionsTable = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  channelId: integer("channel_id").notNull().references(() => channelsTable.id, { onDelete: "cascade" }),
  tier: integer("tier").notNull().default(1),
  status: text("status").notNull().default("active"),
  provider: text("provider").notNull().default("stripe"),
  providerCustomerId: text("provider_customer_id"),
  providerSubscriptionId: text("provider_subscription_id").unique(),
  providerPriceId: text("provider_price_id"),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  activeSubscriptionUnique: uniqueIndex("subscriptions_active_channel_user_unique")
    .on(table.userId, table.channelId)
    .where(sql`${table.status} = 'active'`),
}));

// ─── Creator Payment Accounts ─────────────────────────────────────────────────
// KYC and payout details remain exclusively with the provider. Kryv stores only
// opaque provider identifiers and capability state needed to gate monetization.
export const creatorPaymentAccountsTable = pgTable("creator_payment_accounts", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull().references(() => channelsTable.id, { onDelete: "cascade" }).unique(),
  provider: text("provider").notNull().default("stripe"),
  providerAccountId: text("provider_account_id").notNull().unique(),
  onboardingStatus: text("onboarding_status").notNull().default("pending"),
  chargesEnabled: boolean("charges_enabled").notNull().default(false),
  payoutsEnabled: boolean("payouts_enabled").notNull().default(false),
  detailsSubmitted: boolean("details_submitted").notNull().default(false),
  country: text("country"),
  requirementsDue: jsonb("requirements_due").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  onboardingStatusIdx: index("creator_payment_accounts_onboarding_status_idx").on(table.onboardingStatus),
}));

// ─── Payment Event Ledger ─────────────────────────────────────────────────────
// Stores a provider event ID and result, never raw card, KYC, or webhook payload data.
export const paymentEventsTable = pgTable("payment_events", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull().default("stripe"),
  providerEventId: text("provider_event_id").notNull().unique(),
  eventType: text("event_type").notNull(),
  processingStatus: text("processing_status").notNull().default("received"),
  relatedProviderAccountId: text("related_provider_account_id"),
  relatedProviderPaymentId: text("related_provider_payment_id"),
  errorCode: text("error_code"),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  statusCreatedIdx: index("payment_events_status_created_idx").on(table.processingStatus, table.createdAt.desc()),
}));

// ─── Emotes ───────────────────────────────────────────────────────────────────
export const emotesTable = pgTable("emotes", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").references(() => channelsTable.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  imageUrl: text("image_url").notNull(),
  isGlobal: boolean("is_global").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Clips ────────────────────────────────────────────────────────────────────
export const clipsTable = pgTable("clips", {
  id: serial("id").primaryKey(),
  creatorUserId: integer("creator_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  channelId: integer("channel_id").notNull().references(() => channelsTable.id, { onDelete: "cascade" }),
  videoId: integer("video_id").references(() => videosTable.id, { onDelete: "set null" }),
  fastpixRequestId: text("fastpix_request_id").unique(),
  fastpixMediaId: text("fastpix_media_id").unique(),
  fastpixPlaybackId: text("fastpix_playback_id"),
  processingStatus: text("processing_status").notNull().default("processing"),
  processingError: text("processing_error"),
  title: text("title").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  viewCount: integer("view_count").notNull().default(0),
  durationSeconds: integer("duration_seconds"),
  startOffsetSeconds: integer("start_offset_seconds"),
  endOffsetSeconds: integer("end_offset_seconds"),
  isPublished: boolean("is_published").notNull().default(true),
  language: text("language").default("en"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  channelPublishedCreatedIdx: index("clips_channel_published_created_idx")
    .on(table.channelId, table.createdAt.desc())
    .where(sql`${table.isPublished} = true`),
  processingStatusIdx: index("clips_processing_status_idx").on(table.processingStatus, table.createdAt.desc()),
}));

// ─── Moderators ───────────────────────────────────────────────────────────────
export const moderatorsTable = pgTable("moderators", {
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  channelId: integer("channel_id").notNull().references(() => channelsTable.id, { onDelete: "cascade" }),
  permissions: jsonb("permissions").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.channelId] }),
  channelModeratorIdx: index("moderators_channel_user_idx").on(table.channelId, table.userId),
}));

// ─── Channel Bans ─────────────────────────────────────────────────────────────
export const channelBansTable = pgTable("channel_bans", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  channelId: integer("channel_id").notNull().references(() => channelsTable.id, { onDelete: "cascade" }),
  reason: text("reason"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  channelUserExpiresIdx: index("channel_bans_channel_user_expires_idx").on(table.channelId, table.userId, table.expiresAt),
}));

// ─── Tips / Donations ─────────────────────────────────────────────────────────
export const tipsTable = pgTable("tips", {
  id: serial("id").primaryKey(),
  senderUserId: integer("sender_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  receiverChannelId: integer("receiver_channel_id").notNull().references(() => channelsTable.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  provider: text("provider").notNull().default("stripe"),
  providerPaymentIntentId: text("provider_payment_intent_id").unique(),
  platformFeeAmount: numeric("platform_fee_amount", { precision: 10, scale: 2 }),
  status: text("status").notNull().default("pending"),
  message: text("message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Stream Sessions ──────────────────────────────────────────────────────────
export const streamSessionsTable = pgTable("stream_sessions", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull().references(() => channelsTable.id, { onDelete: "cascade" }),
  streamKey: text("stream_key"),
  title: text("title"),
  categoryId: integer("category_id").references(() => categoriesTable.id, { onDelete: "set null" }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  peakViewers: integer("peak_viewers").notNull().default(0),
  avgViewers: integer("avg_viewers").notNull().default(0),
  totalChatMessages: integer("total_chat_messages").notNull().default(0),
  durationSeconds: integer("duration_seconds"),
  thumbnailUrl: text("thumbnail_url"),
  vodEnabled: boolean("vod_enabled").notNull().default(true),
  vodVideoId: integer("vod_video_id").references(() => videosTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Channel Points ───────────────────────────────────────────────────────────
export const channelPointsTable = pgTable("channel_points", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull().references(() => channelsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  balance: integer("balance").notNull().default(0),
  totalEarned: integer("total_earned").notNull().default(0),
  lastEarnedAt: timestamp("last_earned_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  channelUserUnique: uniqueIndex("channel_points_channel_user_unique").on(table.channelId, table.userId),
}));

export const channelPointRewardsTable = pgTable("channel_point_rewards", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull().references(() => channelsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  cost: integer("cost").notNull().default(100),
  isEnabled: boolean("is_enabled").notNull().default(true),
  isPaused: boolean("is_paused").notNull().default(false),
  backgroundColor: text("background_color").default("#9147FF"),
  imageUrl: text("image_url"),
  maxPerStream: integer("max_per_stream"),
  maxPerUserPerStream: integer("max_per_user_per_stream"),
  cooldownSeconds: integer("cooldown_seconds"),
  autoFulfill: boolean("auto_fulfill").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const channelPointRedemptionsTable = pgTable("channel_point_redemptions", {
  id: serial("id").primaryKey(),
  rewardId: integer("reward_id").notNull().references(() => channelPointRewardsTable.id, { onDelete: "cascade" }),
  channelId: integer("channel_id").notNull().references(() => channelsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  userInput: text("user_input"),
  status: text("status").notNull().default("unfulfilled"),
  redeemedAt: timestamp("redeemed_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Polls ────────────────────────────────────────────────────────────────────
export const pollsTable = pgTable("polls", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull().references(() => channelsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  status: text("status").notNull().default("active"),
  durationSeconds: integer("duration_seconds").notNull().default(60),
  channelPointsVotingEnabled: boolean("channel_points_voting_enabled").notNull().default(false),
  channelPointsPerVote: integer("channel_points_per_vote").default(10),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pollChoicesTable = pgTable("poll_choices", {
  id: serial("id").primaryKey(),
  pollId: integer("poll_id").notNull().references(() => pollsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  votes: integer("votes").notNull().default(0),
  channelPointsVotes: integer("channel_points_votes").notNull().default(0),
});

export const pollVotesTable = pgTable("poll_votes", {
  id: serial("id").primaryKey(),
  pollId: integer("poll_id").notNull().references(() => pollsTable.id, { onDelete: "cascade" }),
  choiceId: integer("choice_id").notNull().references(() => pollChoicesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  channelPointsUsed: integer("channel_points_used").notNull().default(0),
  votedAt: timestamp("voted_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  pollUserUnique: uniqueIndex("poll_votes_poll_user_unique").on(table.pollId, table.userId),
}));

// ─── Predictions ──────────────────────────────────────────────────────────────
export const predictionsTable = pgTable("predictions", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull().references(() => channelsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  status: text("status").notNull().default("active"),
  predictionWindowSeconds: integer("prediction_window_seconds").notNull().default(120),
  winningOutcomeId: integer("winning_outcome_id"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const predictionOutcomesTable = pgTable("prediction_outcomes", {
  id: serial("id").primaryKey(),
  predictionId: integer("prediction_id").notNull().references(() => predictionsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  color: text("color").notNull().default("BLUE"),
  channelPoints: integer("channel_points").notNull().default(0),
  users: integer("users").notNull().default(0),
  topPredictors: jsonb("top_predictors").default([]),
});

export const predictionEntriesTable = pgTable("prediction_predictions", {
  id: serial("id").primaryKey(),
  predictionId: integer("prediction_id").notNull().references(() => predictionsTable.id, { onDelete: "cascade" }),
  outcomeId: integer("outcome_id").notNull().references(() => predictionOutcomesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  channelPointsUsed: integer("channel_points_used").notNull().default(0),
  predictedAt: timestamp("predicted_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  predictionUserUnique: uniqueIndex("prediction_entries_prediction_user_unique").on(table.predictionId, table.userId),
}));

// ─── Raids & Hosts ────────────────────────────────────────────────────────────
export const raidsTable = pgTable("raids", {
  id: serial("id").primaryKey(),
  fromChannelId: integer("from_channel_id").notNull().references(() => channelsTable.id, { onDelete: "cascade" }),
  toChannelId: integer("to_channel_id").notNull().references(() => channelsTable.id, { onDelete: "cascade" }),
  viewerCount: integer("viewer_count").notNull().default(0),
  status: text("status").notNull().default("pending"),
  initiatedAt: timestamp("initiated_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const hostsTable = pgTable("hosts", {
  id: serial("id").primaryKey(),
  hostChannelId: integer("host_channel_id").notNull().references(() => channelsTable.id, { onDelete: "cascade" }),
  hostedChannelId: integer("hosted_channel_id").notNull().references(() => channelsTable.id, { onDelete: "cascade" }),
  autoHost: boolean("auto_host").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Chat Moderation ──────────────────────────────────────────────────────────
export const chatTimeoutsTable = pgTable("chat_timeouts", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull().references(() => channelsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  moderatorUserId: integer("moderator_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  reason: text("reason"),
  durationSeconds: integer("duration_seconds").notNull().default(600),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  channelUserExpiresIdx: index("chat_timeouts_channel_user_expires_idx").on(table.channelId, table.userId, table.expiresAt),
}));

export const chatCommandsTable = pgTable("chat_commands", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull().references(() => channelsTable.id, { onDelete: "cascade" }),
  command: text("command").notNull(),
  response: text("response").notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  cooldownSeconds: integer("cooldown_seconds").notNull().default(5),
  useCount: integer("use_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Stream Alerts ────────────────────────────────────────────────────────────
export const streamAlertsTable = pgTable("stream_alerts", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull().references(() => channelsTable.id, { onDelete: "cascade" }),
  alertType: text("alert_type").notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  messageTemplate: text("message_template"),
  soundUrl: text("sound_url"),
  imageUrl: text("image_url"),
  durationSeconds: integer("duration_seconds").notNull().default(5),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Channel Schedules ────────────────────────────────────────────────────────
export const channelSchedulesTable = pgTable("channel_schedules", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull().references(() => channelsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  categoryId: integer("category_id").references(() => categoriesTable.id, { onDelete: "set null" }),
  scheduledStart: timestamp("scheduled_start", { withTimezone: true }).notNull(),
  scheduledEnd: timestamp("scheduled_end", { withTimezone: true }),
  isRecurring: boolean("is_recurring").notNull().default(false),
  recurrencePattern: text("recurrence_pattern"),
  timezone: text("timezone").notNull().default("UTC"),
  canceled: boolean("canceled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Channel Tags ─────────────────────────────────────────────────────────────
export const channelTagsTable = pgTable("channel_tags", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull().references(() => channelsTable.id, { onDelete: "cascade" }),
  tag: text("tag").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Viewer Sessions ──────────────────────────────────────────────────────────
export const viewerSessionsTable = pgTable("viewer_sessions", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull().references(() => channelsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  sessionToken: text("session_token"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  leftAt: timestamp("left_at", { withTimezone: true }),
  watchDurationSeconds: integer("watch_duration_seconds").notNull().default(0),
  isAnonymous: boolean("is_anonymous").notNull().default(false),
});

// ─── Notifications ────────────────────────────────────────────────────────────
export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message"),
  data: jsonb("data").default({}),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notificationPreferencesTable = pgTable("notification_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  channelId: integer("channel_id").references(() => channelsTable.id, { onDelete: "cascade" }),
  notifyOnLive: boolean("notify_on_live").notNull().default(true),
  notifyOnUpload: boolean("notify_on_upload").notNull().default(true),
  notifyOnClip: boolean("notify_on_clip").notNull().default(false),
  emailNotifications: boolean("email_notifications").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userChannelIdx: index("notification_preferences_user_channel_idx").on(table.userId, table.channelId),
}));

// ─── Blocked Users ────────────────────────────────────────────────────────────
export const blockedUsersTable = pgTable("blocked_users", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  blockedUserId: integer("blocked_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── User Badges ──────────────────────────────────────────────────────────────
export const userBadgesTable = pgTable("user_badges", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  channelId: integer("channel_id").references(() => channelsTable.id, { onDelete: "cascade" }),
  badgeType: text("badge_type").notNull(),
  awardedAt: timestamp("awarded_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Hype Trains ──────────────────────────────────────────────────────────────
export const hypeTrainsTable = pgTable("hype_trains", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull().references(() => channelsTable.id, { onDelete: "cascade" }),
  level: integer("level").notNull().default(1),
  totalPoints: integer("total_points").notNull().default(0),
  goalPoints: integer("goal_points").notNull().default(1000),
  topContributions: jsonb("top_contributions").default([]),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  status: text("status").notNull().default("active"),
});

export const hypeTrainContributionsTable = pgTable("hype_train_contributions", {
  id: serial("id").primaryKey(),
  hypeTrainId: integer("hype_train_id").notNull().references(() => hypeTrainsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  contributionType: text("contribution_type").notNull(),
  total: integer("total").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Channel Goals ────────────────────────────────────────────────────────────
export const channelGoalsTable = pgTable("channel_goals", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull().references(() => channelsTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  description: text("description").notNull(),
  currentAmount: integer("current_amount").notNull().default(0),
  targetAmount: integer("target_amount").notNull(),
  isAchieved: boolean("is_achieved").notNull().default(false),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

// ─── Stream Markers ───────────────────────────────────────────────────────────
export const streamMarkersTable = pgTable("stream_markers", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull().references(() => channelsTable.id, { onDelete: "cascade" }),
  streamSessionId: integer("stream_session_id").references(() => streamSessionsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  description: text("description"),
  positionSeconds: integer("position_seconds").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Clip Reactions ───────────────────────────────────────────────────────────
export const clipReactionsTable = pgTable("clip_reactions", {
  id: serial("id").primaryKey(),
  clipId: integer("clip_id").notNull().references(() => clipsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  reaction: text("reaction").notNull().default("like"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
