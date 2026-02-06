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
      media_type TEXT NOT NULL CHECK(media_type IN ('movie', 'tv')),
      title TEXT NOT NULL,
      poster_path TEXT,
      status TEXT NOT NULL DEFAULT 'unknown' CHECK(status IN ('unknown', 'pending', 'processing', 'partial', 'available')),
      requested_by_plex_id TEXT REFERENCES users(plex_id),
      requested_at TEXT,
      rating_key TEXT,
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
      vote TEXT NOT NULL CHECK(vote IN ('keep', 'delete')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX user_votes_media_user_idx ON user_votes(media_item_id, user_plex_id);

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
    INSERT INTO media_items (id, overseerr_id, tmdb_id, media_type, title, status, requested_by_plex_id, rating_key, requested_at) VALUES
      (1, 100, 1000, 'movie', 'Test Movie 1', 'available', 'plex-user-1', 'rk-1', '2024-01-01'),
      (2, 101, 1001, 'movie', 'Test Movie 2', 'available', 'plex-user-1', 'rk-2', '2024-01-02'),
      (3, 102, 1002, 'tv', 'Test Show 1', 'available', 'plex-user-1', 'rk-3', '2024-01-03'),
      (4, 103, 1003, 'tv', 'Test Show 2', 'pending', 'plex-user-1', NULL, '2024-01-04'),
      (5, 104, 1004, 'movie', 'Other Movie', 'available', 'plex-user-2', 'rk-5', '2024-01-05'),
      (6, 105, 1005, 'movie', 'Another Movie', 'processing', 'plex-user-1', 'rk-6', '2024-01-06');
  `);

  // Votes
  sqlite.exec(`
    INSERT INTO user_votes (media_item_id, user_plex_id, vote) VALUES
      (1, 'plex-user-1', 'keep'),
      (2, 'plex-user-1', 'delete'),
      (5, 'plex-user-2', 'delete');
  `);

  // Watch status
  sqlite.exec(`
    INSERT INTO watch_status (media_item_id, user_plex_id, watched, play_count, last_watched_at) VALUES
      (1, 'plex-user-1', 1, 3, '2024-06-01T00:00:00Z'),
      (3, 'plex-user-1', 0, 1, '2024-05-01T00:00:00Z'),
      (5, 'plex-user-2', 1, 2, '2024-06-15T00:00:00Z');
  `);
}
