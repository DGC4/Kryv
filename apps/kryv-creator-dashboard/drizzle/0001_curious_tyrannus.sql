CREATE TABLE `creator_activities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` varchar(64) NOT NULL,
	`message` varchar(255) NOT NULL,
	`occurredAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `creator_activities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `creator_notification_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`streamAlerts` boolean NOT NULL DEFAULT true,
	`followerAlerts` boolean NOT NULL DEFAULT true,
	`revenueAlerts` boolean NOT NULL DEFAULT true,
	`weeklyDigest` boolean NOT NULL DEFAULT true,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `creator_notification_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `creator_notification_preferences_user_id_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `creator_payouts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`periodLabel` varchar(80) NOT NULL,
	`amountCents` int NOT NULL,
	`status` enum('pending','paid','failed') NOT NULL DEFAULT 'pending',
	`paidAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `creator_payouts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `creator_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`displayName` varchar(60) NOT NULL,
	`bio` text,
	`avatarUrl` varchar(2048),
	`brandColor` varchar(16) NOT NULL DEFAULT '#8B5CF6',
	`channelSlug` varchar(90) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `creator_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `creator_profiles_user_id_unique` UNIQUE(`userId`),
	CONSTRAINT `creator_profiles_channel_slug_unique` UNIQUE(`channelSlug`)
);
--> statement-breakpoint
CREATE TABLE `creator_stream_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`rtmpServerUrl` varchar(512),
	`streamKeyHash` varchar(128),
	`streamKeyPreview` varchar(32),
	`streamTitle` varchar(140) NOT NULL DEFAULT '',
	`category` varchar(80),
	`isLive` boolean NOT NULL DEFAULT false,
	`lastKeyRotatedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `creator_stream_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `creator_stream_settings_user_id_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `stream_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(140) NOT NULL,
	`startedAt` timestamp NOT NULL,
	`endedAt` timestamp,
	`peakViewers` int NOT NULL DEFAULT 0,
	`totalViews` int NOT NULL DEFAULT 0,
	`followerGains` int NOT NULL DEFAULT 0,
	`revenueCents` int NOT NULL DEFAULT 0,
	CONSTRAINT `stream_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `creator_activities` ADD CONSTRAINT `creator_activities_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `creator_notification_preferences` ADD CONSTRAINT `creator_notification_preferences_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `creator_payouts` ADD CONSTRAINT `creator_payouts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `creator_profiles` ADD CONSTRAINT `creator_profiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `creator_stream_settings` ADD CONSTRAINT `creator_stream_settings_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stream_sessions` ADD CONSTRAINT `stream_sessions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `creator_activities_user_occurred_at_index` ON `creator_activities` (`userId`,`occurredAt`);--> statement-breakpoint
CREATE INDEX `creator_payouts_user_created_at_index` ON `creator_payouts` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `stream_sessions_user_started_at_index` ON `stream_sessions` (`userId`,`startedAt`);