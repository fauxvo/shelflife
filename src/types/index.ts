import type { users, mediaItems, watchStatus, userVotes, syncLog } from "@/lib/db/schema";

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type MediaItem = typeof mediaItems.$inferSelect;
export type NewMediaItem = typeof mediaItems.$inferInsert;

export type WatchStatus = typeof watchStatus.$inferSelect;
export type NewWatchStatus = typeof watchStatus.$inferInsert;

export type UserVote = typeof userVotes.$inferSelect;
export type NewUserVote = typeof userVotes.$inferInsert;

export type SyncLogEntry = typeof syncLog.$inferSelect;
export type NewSyncLogEntry = typeof syncLog.$inferInsert;

export type VoteValue = "keep" | "delete";
export type MediaType = "movie" | "tv";
export type MediaStatus = "unknown" | "pending" | "processing" | "partial" | "available";
export type SyncType = "overseerr" | "tautulli" | "full";
export type SyncStatus = "running" | "completed" | "failed";

export interface SessionPayload {
  userId: number;
  plexId: string;
  username: string;
  isAdmin: boolean;
}

export interface MediaItemWithVote extends MediaItem {
  vote: VoteValue | null;
  watchStatus: {
    watched: boolean;
    playCount: number;
    lastWatchedAt: string | null;
  } | null;
}

export interface DeletionCandidate extends MediaItem {
  requestedByUsername: string;
  vote: VoteValue;
  watched: boolean;
  playCount: number;
}
