CREATE TABLE `community_votes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`media_item_id` integer NOT NULL,
	`user_plex_id` text NOT NULL,
	`vote` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`media_item_id`) REFERENCES `media_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_plex_id`) REFERENCES `users`(`plex_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `community_votes_media_user_idx` ON `community_votes` (`media_item_id`,`user_plex_id`);--> statement-breakpoint
CREATE TABLE `review_actions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`review_round_id` integer NOT NULL,
	`media_item_id` integer NOT NULL,
	`action` text NOT NULL,
	`acted_at` text DEFAULT (datetime('now')) NOT NULL,
	`acted_by_plex_id` text NOT NULL,
	FOREIGN KEY (`review_round_id`) REFERENCES `review_rounds`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`media_item_id`) REFERENCES `media_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`acted_by_plex_id`) REFERENCES `users`(`plex_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `review_rounds` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`started_at` text DEFAULT (datetime('now')) NOT NULL,
	`closed_at` text,
	`created_by_plex_id` text NOT NULL,
	FOREIGN KEY (`created_by_plex_id`) REFERENCES `users`(`plex_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `media_items` ADD `imdb_id` text;