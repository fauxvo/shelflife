CREATE TABLE `user_review_statuses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`review_round_id` integer NOT NULL,
	`user_plex_id` text NOT NULL,
	`nominations_complete` integer DEFAULT false NOT NULL,
	`voting_complete` integer DEFAULT false NOT NULL,
	`nominations_completed_at` text,
	`voting_completed_at` text,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`review_round_id`) REFERENCES `review_rounds`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_plex_id`) REFERENCES `users`(`plex_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_review_statuses_round_user_idx` ON `user_review_statuses` (`review_round_id`,`user_plex_id`);