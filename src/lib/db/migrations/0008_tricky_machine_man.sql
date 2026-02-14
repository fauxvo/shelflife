CREATE TABLE `deletion_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`media_item_id` integer NOT NULL,
	`review_round_id` integer,
	`deleted_by_plex_id` text NOT NULL,
	`delete_files` integer DEFAULT false NOT NULL,
	`sonarr_success` integer,
	`radarr_success` integer,
	`overseerr_success` integer,
	`errors` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`media_item_id`) REFERENCES `media_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`review_round_id`) REFERENCES `review_rounds`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`deleted_by_plex_id`) REFERENCES `users`(`plex_id`) ON UPDATE no action ON DELETE no action
);
