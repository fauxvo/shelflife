-- Fix: migration 0011 created community_votes.review_round_id WITHOUT ON DELETE CASCADE.
-- SQLite cannot ALTER a FK constraint, so we must recreate the table.
-- Community votes are preserved during the table swap.
PRAGMA foreign_keys = OFF;--> statement-breakpoint
DROP TABLE IF EXISTS community_votes_new;--> statement-breakpoint
CREATE TABLE community_votes_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  media_item_id INTEGER NOT NULL REFERENCES media_items(id),
  user_plex_id TEXT NOT NULL REFERENCES users(plex_id),
  review_round_id INTEGER NOT NULL REFERENCES review_rounds(id) ON DELETE CASCADE,
  vote TEXT NOT NULL CHECK(vote IN ('keep')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);--> statement-breakpoint
INSERT INTO community_votes_new (id, media_item_id, user_plex_id, review_round_id, vote, created_at, updated_at)
  SELECT id, media_item_id, user_plex_id, review_round_id, vote, created_at, updated_at
  FROM community_votes;--> statement-breakpoint
DROP TABLE community_votes;--> statement-breakpoint
ALTER TABLE community_votes_new RENAME TO community_votes;--> statement-breakpoint
CREATE UNIQUE INDEX community_votes_media_user_round_idx ON community_votes(media_item_id, user_plex_id, review_round_id);--> statement-breakpoint
PRAGMA foreign_keys = ON;
