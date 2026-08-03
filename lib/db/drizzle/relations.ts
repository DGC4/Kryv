import { relations } from "drizzle-orm/relations";
import { users, channels, categories, videos, chatMessages, follows, watchHistory } from "./schema";

export const channelsRelations = relations(channels, ({one, many}) => ({
	user: one(users, {
		fields: [channels.ownerUserId],
		references: [users.id]
	}),
	category: one(categories, {
		fields: [channels.categoryId],
		references: [categories.id]
	}),
	videos: many(videos),
	chatMessages: many(chatMessages),
	follows: many(follows),
}));

export const usersRelations = relations(users, ({many}) => ({
	channels: many(channels),
	chatMessages: many(chatMessages),
	follows: many(follows),
	watchHistories: many(watchHistory),
}));

export const categoriesRelations = relations(categories, ({many}) => ({
	channels: many(channels),
	videos: many(videos),
}));

export const videosRelations = relations(videos, ({one, many}) => ({
	channel: one(channels, {
		fields: [videos.channelId],
		references: [channels.id]
	}),
	category: one(categories, {
		fields: [videos.categoryId],
		references: [categories.id]
	}),
	watchHistories: many(watchHistory),
}));

export const chatMessagesRelations = relations(chatMessages, ({one}) => ({
	channel: one(channels, {
		fields: [chatMessages.channelId],
		references: [channels.id]
	}),
	user: one(users, {
		fields: [chatMessages.userId],
		references: [users.id]
	}),
}));

export const followsRelations = relations(follows, ({one}) => ({
	user: one(users, {
		fields: [follows.followerUserId],
		references: [users.id]
	}),
	channel: one(channels, {
		fields: [follows.channelId],
		references: [channels.id]
	}),
}));

export const watchHistoryRelations = relations(watchHistory, ({one}) => ({
	user: one(users, {
		fields: [watchHistory.userId],
		references: [users.id]
	}),
	video: one(videos, {
		fields: [watchHistory.videoId],
		references: [videos.id]
	}),
}));