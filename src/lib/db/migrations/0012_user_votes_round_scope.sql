-- Add review_round_id to user_votes for proper round scoping.
-- Existing rows are dropped (nominations are ephemeral round-scoped data).
-- Note: community_votes ON DELETE CASCADE fix is handled in migration 0013.
DROP INDEX IF EXISTS user_votes_media_user_idx;--> statement-breakpoint
DROP INDEX IF EXISTS user_votes_media_user_round_idx;--> statement-breakpoint
DELETE FROM user_votes;--> statement-breakpoint
ALTER TABLE user_votes ADD COLUMN review_round_id INTEGER NOT NULL REFERENCES review_rounds(id) ON DELETE CASCADE;--> statement-breakpoint
CREATE UNIQUE INDEX user_votes_media_user_round_idx ON user_votes(media_item_id, user_plex_id, review_round_id);
