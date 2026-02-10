import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  plexId: text("plex_id").unique().notNull(),
  plexToken: text("plex_token"),
  username: text("username").notNull(),
  email: text("email"),
  avatarUrl: text("avatar_url"),
  isAdmin: integer("is_admin", { mode: "boolean" }).default(false).notNull(),
  createdAt: text("created_at")
    .default(sql`(datetime('now'))`)
    .notNull(),
  updatedAt: text("updated_at")
    .default(sql`(datetime('now'))`)
    .notNull(),
});

export const mediaItems = sqliteTable("media_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  overseerrId: integer("overseerr_id").unique(),
  overseerrRequestId: integer("overseerr_request_id"),
  tmdbId: integer("tmdb_id"),
  tvdbId: integer("tvdb_id"),
  imdbId: text("imdb_id"),
  mediaType: text("media_type", { enum: ["movie", "tv"] }).notNull(),
  title: text("title").notNull(),
  posterPath: text("poster_path"),
  status: text("status", {
    enum: ["unknown", "pending", "processing", "partial", "available", "removed"],
  })
    .default("unknown")
    .notNull(),
  requestedByPlexId: text("requested_by_plex_id").references(() => users.plexId),
  requestedAt: text("requested_at"),
  ratingKey: text("rating_key"),
  seasonCount: integer("season_count"),
  lastSyncedAt: text("last_synced_at"),
  createdAt: text("created_at")
    .default(sql`(datetime('now'))`)
    .notNull(),
  updatedAt: text("updated_at")
    .default(sql`(datetime('now'))`)
    .notNull(),
});

export const watchStatus = sqliteTable("watch_status", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  mediaItemId: integer("media_item_id")
    .references(() => mediaItems.id)
    .notNull(),
  userPlexId: text("user_plex_id")
    .references(() => users.plexId)
    .notNull(),
  watched: integer("watched", { mode: "boolean" }).default(false).notNull(),
  playCount: integer("play_count").default(0).notNull(),
  lastWatchedAt: text("last_watched_at"),
  syncedAt: text("synced_at")
    .default(sql`(datetime('now'))`)
    .notNull(),
});

export const userVotes = sqliteTable(
  "user_votes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    mediaItemId: integer("media_item_id")
      .references(() => mediaItems.id)
      .notNull(),
    userPlexId: text("user_plex_id")
      .references(() => users.plexId)
      .notNull(),
    vote: text("vote", { enum: ["delete", "trim"] }).notNull(),
    keepSeasons: integer("keep_seasons"),
    createdAt: text("created_at")
      .default(sql`(datetime('now'))`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`(datetime('now'))`)
      .notNull(),
  },
  (table) => [uniqueIndex("user_votes_media_user_idx").on(table.mediaItemId, table.userPlexId)]
);

export const communityVotes = sqliteTable(
  "community_votes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    mediaItemId: integer("media_item_id")
      .references(() => mediaItems.id)
      .notNull(),
    userPlexId: text("user_plex_id")
      .references(() => users.plexId)
      .notNull(),
    vote: text("vote", { enum: ["keep"] }).notNull(),
    createdAt: text("created_at")
      .default(sql`(datetime('now'))`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`(datetime('now'))`)
      .notNull(),
  },
  (table) => [uniqueIndex("community_votes_media_user_idx").on(table.mediaItemId, table.userPlexId)]
);

export const reviewRounds = sqliteTable("review_rounds", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  status: text("status", { enum: ["active", "closed"] })
    .default("active")
    .notNull(),
  startedAt: text("started_at")
    .default(sql`(datetime('now'))`)
    .notNull(),
  closedAt: text("closed_at"),
  createdByPlexId: text("created_by_plex_id")
    .references(() => users.plexId)
    .notNull(),
});

export const reviewActions = sqliteTable(
  "review_actions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    reviewRoundId: integer("review_round_id")
      .references(() => reviewRounds.id)
      .notNull(),
    mediaItemId: integer("media_item_id")
      .references(() => mediaItems.id)
      .notNull(),
    action: text("action", { enum: ["remove", "keep", "skip"] }).notNull(),
    actedAt: text("acted_at")
      .default(sql`(datetime('now'))`)
      .notNull(),
    actedByPlexId: text("acted_by_plex_id")
      .references(() => users.plexId)
      .notNull(),
  },
  (table) => [
    uniqueIndex("review_actions_round_item_idx").on(table.reviewRoundId, table.mediaItemId),
  ]
);

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at")
    .default(sql`(datetime('now'))`)
    .notNull(),
});

export const syncLog = sqliteTable("sync_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  syncType: text("sync_type", {
    enum: ["overseerr", "tautulli", "full"],
  }).notNull(),
  status: text("status", {
    enum: ["running", "completed", "failed"],
  }).notNull(),
  itemsSynced: integer("items_synced").default(0).notNull(),
  errors: text("errors"),
  startedAt: text("started_at")
    .default(sql`(datetime('now'))`)
    .notNull(),
  completedAt: text("completed_at"),
});
