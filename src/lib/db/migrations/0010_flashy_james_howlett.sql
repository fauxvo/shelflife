ALTER TABLE `media_items` ADD `sonarr_id` integer;--> statement-breakpoint
ALTER TABLE `media_items` ADD `radarr_id` integer;--> statement-breakpoint
ALTER TABLE `media_items` ADD `added_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `media_items_sonarr_id_unique` ON `media_items` (`sonarr_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `media_items_radarr_id_unique` ON `media_items` (`radarr_id`);