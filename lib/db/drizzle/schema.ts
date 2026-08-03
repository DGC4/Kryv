import { pgTable, text, boolean, timestamp, foreignKey, unique, serial, integer, primaryKey } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const users = pgTable("users", {
	id: text().primaryKey().notNull(),
	username: text().notNull(),
	avatarUrl: text("avatar_url"),
	role: text().default('user').notNull(),
	banned: boolean().default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const channels = pgTable("channels", {
	id: serial().primaryKey().notNull(),
	ownerUserId: text("owner_user_id").notNull(),
	slug: text().notNull(),
	displayName: text("display_name").notNull(),
	description: text(),
	avatarUrl: text("avatar_url"),
	bannerUrl: text("banner_url"),
	categoryId: integer("category_id"),
	streamTitle: text("stream_title"),
	isLive: boolean("is_live").default(false).notNull(),
	viewerCount: integer("viewer_count").default(0).notNull(),
	muxLiveStreamId: text("mux_live_stream_id"),
	muxStreamKey: text("mux_stream_key"),
	muxPlaybackId: text("mux_playback_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.ownerUserId],
			foreignColumns: [users.id],
			name: "channels_owner_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [categories.id],
			name: "channels_category_id_categories_id_fk"
		}).onDelete("set null"),
	unique("channels_owner_user_id_unique").on(table.ownerUserId),
	unique("channels_slug_unique").on(table.slug),
]);

export const categories = pgTable("categories", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	slug: text().notNull(),
	kind: text().default('live_game').notNull(),
	imageUrl: text("image_url"),
}, (table) => [
	unique("categories_slug_unique").on(table.slug),
]);

export const videos = pgTable("videos", {
	id: serial().primaryKey().notNull(),
	channelId: integer("channel_id").notNull(),
	title: text().notNull(),
	description: text(),
	thumbnailUrl: text("thumbnail_url"),
	posterUrl: text("poster_url"),
	backdropUrl: text("backdrop_url"),
	categoryId: integer("category_id"),
	contentType: text("content_type").default('upload').notNull(),
	uploadStatus: text("upload_status").default('waiting').notNull(),
	durationSeconds: integer("duration_seconds"),
	viewCount: integer("view_count").default(0).notNull(),
	muxUploadId: text("mux_upload_id"),
	muxAssetId: text("mux_asset_id"),
	muxPlaybackId: text("mux_playback_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.channelId],
			foreignColumns: [channels.id],
			name: "videos_channel_id_channels_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [categories.id],
			name: "videos_category_id_categories_id_fk"
		}).onDelete("set null"),
]);

export const chatMessages = pgTable("chat_messages", {
	id: serial().primaryKey().notNull(),
	channelId: integer("channel_id").notNull(),
	userId: text("user_id").notNull(),
	message: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.channelId],
			foreignColumns: [channels.id],
			name: "chat_messages_channel_id_channels_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "chat_messages_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const follows = pgTable("follows", {
	id: serial().primaryKey().notNull(),
	followerUserId: text("follower_user_id").notNull(),
	channelId: integer("channel_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.followerUserId],
			foreignColumns: [users.id],
			name: "follows_follower_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.channelId],
			foreignColumns: [channels.id],
			name: "follows_channel_id_channels_id_fk"
		}).onDelete("cascade"),
]);

export const watchHistory = pgTable("watch_history", {
	userId: text("user_id").notNull(),
	videoId: integer("video_id").notNull(),
	watchedAt: timestamp("watched_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	progressSeconds: integer("progress_seconds").default(0).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "watch_history_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.videoId],
			foreignColumns: [videos.id],
			name: "watch_history_video_id_videos_id_fk"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.videoId, table.userId], name: "watch_history_user_id_video_id_pk"}),
]);
