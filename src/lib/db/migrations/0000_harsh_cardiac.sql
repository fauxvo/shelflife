CREATE TABLE `media_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`overseerr_id` integer,
	`overseerr_request_id` integer,
	`tmdb_id` integer,
	`tvdb_id` integer,
	`media_type` text NOT NULL,
	`title` text NOT NULL,
	`poster_path` text,
	`status` text DEFAULT 'unknown' NOT NULL,
	`requested_by_plex_id` text,
	`requested_at` text,
	`rating_key` text,
	`last_synced_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`requested_by_plex_id`) REFERENCES `users`(`plex_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_items_overseerr_id_unique` ON `media_items` (`overseerr_id`);--> statement-breakpoint
CREATE TABLE `sync_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sync_type` text NOT NULL,
	`status` text NOT NULL,
	`items_synced` integer DEFAULT 0 NOT NULL,
	`errors` text,
	`started_at` text DEFAULT (datetime('now')) NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE TABLE `user_votes` (
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
CREATE UNIQUE INDEX `user_votes_media_user_idx` ON `user_votes` (`media_item_id`,`user_plex_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`plex_id` text NOT NULL,
	`plex_token` text,
	`username` text NOT NULL,
	`email` text,
	`avatar_url` text,
	`is_admin` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_plex_id_unique` ON `users` (`plex_id`);--> statement-breakpoint
CREATE TABLE `watch_status` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`media_item_id` integer NOT NULL,
	`user_plex_id` text NOT NULL,
	`watched` integer DEFAULT false NOT NULL,
	`play_count` integer DEFAULT 0 NOT NULL,
	`last_watched_at` text,
	`synced_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`media_item_id`) REFERENCES `media_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_plex_id`) REFERENCES `users`(`plex_id`) ON UPDATE no action ON DELETE no action
);
