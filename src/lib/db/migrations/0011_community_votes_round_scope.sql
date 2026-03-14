-- Add review_round_id to community_votes for proper round scoping.
-- Existing rows are dropped (community votes are ephemeral round-scoped data).
DROP INDEX IF EXISTS community_votes_media_user_idx;--> statement-breakpoint
DELETE FROM community_votes;--> statement-breakpoint
ALTER TABLE community_votes ADD COLUMN review_round_id INTEGER NOT NULL REFERENCES review_rounds(id);--> statement-breakpoint
CREATE UNIQUE INDEX community_votes_media_user_round_idx ON community_votes(media_item_id, user_plex_id, review_round_id);
