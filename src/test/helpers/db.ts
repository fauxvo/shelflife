import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@/lib/db/schema";

export function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  sqlite.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plex_id TEXT UNIQUE NOT NULL,
      plex_token TEXT,
      username TEXT NOT NULL,
      email TEXT,
      avatar_url TEXT,
      is_admin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE media_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      overseerr_id INTEGER UNIQUE,
      overseerr_request_id INTEGER,
      tmdb_id INTEGER,
      tvdb_id INTEGER,
      imdb_id TEXT,
      media_type TEXT NOT NULL CHECK(media_type IN ('movie', 'tv')),
      title TEXT NOT NULL,
      poster_path TEXT,
      status TEXT NOT NULL DEFAULT 'unknown' CHECK(status IN ('unknown', 'pending', 'processing', 'partial', 'available', 'removed')),
      requested_by_plex_id TEXT REFERENCES users(plex_id),
      requested_at TEXT,
      rating_key TEXT,
      season_count INTEGER,
      available_season_count INTEGER,
      last_synced_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE watch_status (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      media_item_id INTEGER NOT NULL REFERENCES media_items(id),
      user_plex_id TEXT NOT NULL REFERENCES users(plex_id),
      watched INTEGER NOT NULL DEFAULT 0,
      play_count INTEGER NOT NULL DEFAULT 0,
      last_watched_at TEXT,
      synced_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE user_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      media_item_id INTEGER NOT NULL REFERENCES media_items(id),
      user_plex_id TEXT NOT NULL REFERENCES users(plex_id),
      vote TEXT NOT NULL CHECK(vote IN ('delete', 'trim')),
      keep_seasons INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX user_votes_media_user_idx ON user_votes(media_item_id, user_plex_id);

    CREATE TABLE community_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      media_item_id INTEGER NOT NULL REFERENCES media_items(id),
      user_plex_id TEXT NOT NULL REFERENCES users(plex_id),
      vote TEXT NOT NULL CHECK(vote IN ('keep')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX community_votes_media_user_idx ON community_votes(media_item_id, user_plex_id);

    CREATE TABLE review_rounds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'closed')),
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      closed_at TEXT,
      end_date TEXT,
      created_by_plex_id TEXT NOT NULL REFERENCES users(plex_id)
    );

    CREATE TABLE review_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      review_round_id INTEGER NOT NULL REFERENCES review_rounds(id),
      media_item_id INTEGER NOT NULL REFERENCES media_items(id),
      action TEXT NOT NULL CHECK(action IN ('remove', 'keep', 'skip')),
      acted_at TEXT NOT NULL DEFAULT (datetime('now')),
      acted_by_plex_id TEXT NOT NULL REFERENCES users(plex_id)
    );

    CREATE UNIQUE INDEX review_actions_round_item_idx ON review_actions(review_round_id, media_item_id);

    CREATE TABLE app_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sync_type TEXT NOT NULL CHECK(sync_type IN ('overseerr', 'tautulli', 'full')),
      status TEXT NOT NULL CHECK(status IN ('running', 'completed', 'failed')),
      items_synced INTEGER NOT NULL DEFAULT 0,
      errors TEXT,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT
    );
  `);

  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}

export function seedTestData(db: ReturnType<typeof createTestDb>["db"]) {
  const sqlite = (db as any).session.client as Database.Database;

  // Users
  sqlite.exec(`
    INSERT INTO users (plex_id, username, email, is_admin) VALUES
      ('plex-user-1', 'testuser', 'test@example.com', 0),
      ('plex-user-2', 'otheruser', 'other@example.com', 0),
      ('plex-admin', 'adminuser', 'admin@example.com', 1);
  `);

  // Media items - mix of types, statuses, and owners
  sqlite.exec(`
    INSERT INTO media_items (id, overseerr_id, tmdb_id, media_type, title, status, requested_by_plex_id, rating_key, requested_at, season_count) VALUES
      (1, 100, 1000, 'movie', 'Test Movie 1', 'available', 'plex-user-1', 'rk-1', '2024-01-01', NULL),
      (2, 101, 1001, 'movie', 'Test Movie 2', 'available', 'plex-user-1', 'rk-2', '2024-01-02', NULL),
      (3, 102, 1002, 'tv', 'Test Show 1', 'available', 'plex-user-1', 'rk-3', '2024-01-03', 5),
      (4, 103, 1003, 'tv', 'Test Show 2', 'pending', 'plex-user-1', NULL, '2024-01-04', 1),
      (5, 104, 1004, 'movie', 'Other Movie', 'available', 'plex-user-2', 'rk-5', '2024-01-05', NULL),
      (6, 105, 1005, 'movie', 'Another Movie', 'processing', 'plex-user-1', 'rk-6', '2024-01-06', NULL),
      (7, 106, 1006, 'tv', 'Big Brother', 'available', 'plex-user-1', 'rk-7', '2024-01-07', 8);
  `);

  // Votes
  sqlite.exec(`
    INSERT INTO user_votes (media_item_id, user_plex_id, vote, keep_seasons) VALUES
      (2, 'plex-user-1', 'delete', NULL),
      (5, 'plex-user-2', 'delete', NULL),
      (7, 'plex-user-1', 'trim', 1);
  `);

  // Watch status
  sqlite.exec(`
    INSERT INTO watch_status (media_item_id, user_plex_id, watched, play_count, last_watched_at) VALUES
      (1, 'plex-user-1', 1, 3, '2024-06-01T00:00:00Z'),
      (3, 'plex-user-1', 0, 1, '2024-05-01T00:00:00Z'),
      (5, 'plex-user-2', 1, 2, '2024-06-15T00:00:00Z');
  `);

  // Community votes on items that have been self-nominated for deletion (items 2 and 5)
  sqlite.exec(`
    INSERT INTO community_votes (media_item_id, user_plex_id, vote) VALUES
      (2, 'plex-user-2', 'keep'),
      (2, 'plex-admin', 'keep'),
      (5, 'plex-user-1', 'keep');
  `);
}
