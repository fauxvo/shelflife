import type {
  users,
  mediaItems,
  watchStatus,
  userVotes,
  syncLog,
  communityVotes,
  reviewRounds,
  reviewActions,
} from "@/lib/db/schema";

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

export type CommunityVote = typeof communityVotes.$inferSelect;
export type NewCommunityVote = typeof communityVotes.$inferInsert;

export type ReviewRound = typeof reviewRounds.$inferSelect;
export type NewReviewRound = typeof reviewRounds.$inferInsert;

export type ReviewAction = typeof reviewActions.$inferSelect;
export type NewReviewAction = typeof reviewActions.$inferInsert;

export type VoteValue = "keep" | "delete" | "trim";
export type CommunityVoteValue = "keep" | "remove";
export type MediaType = "movie" | "tv";
export type MediaStatus =
  | "unknown"
  | "pending"
  | "processing"
  | "partial"
  | "available"
  | "removed";
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
  keepSeasons: number | null;
  watchStatus: {
    watched: boolean;
    playCount: number;
    lastWatchedAt: string | null;
  } | null;
}

export interface CommunityCandidate {
  id: number;
  title: string;
  mediaType: "movie" | "tv";
  posterPath: string | null;
  status: string;
  imdbId: string | null;
  requestedByUsername: string;
  requestedAt: string | null;
  seasonCount: number | null;
  nominationType: "delete" | "trim";
  keepSeasons: number | null;
  watchStatus: {
    watched: boolean;
    playCount: number;
    lastWatchedAt: string | null;
  } | null;
  tally: { keepCount: number; removeCount: number };
  currentUserVote: CommunityVoteValue | null;
  isOwn: boolean;
}
