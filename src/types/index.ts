import type {
  users,
  mediaItems,
  watchStatus,
  userVotes,
  syncLog,
  communityVotes,
  reviewRounds,
  reviewActions,
  userReviewStatuses,
  deletionLog,
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

export type UserReviewStatus = typeof userReviewStatuses.$inferSelect;
export type NewUserReviewStatus = typeof userReviewStatuses.$inferInsert;

export type DeletionLogEntry = typeof deletionLog.$inferSelect;
export type NewDeletionLogEntry = typeof deletionLog.$inferInsert;

export type VoteValue = "delete" | "trim";
export type CommunityVoteValue = "keep";
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

export interface DeletionResult {
  mediaItemId: number;
  sonarr: { attempted: boolean; success: boolean | null; error?: string };
  radarr: { attempted: boolean; success: boolean | null; error?: string };
  overseerr: { attempted: boolean; success: boolean | null; error?: string };
}

export interface DeletionServiceStatus {
  sonarr: boolean;
  radarr: boolean;
  overseerr: boolean;
}

export interface SessionPayload {
  userId: number;
  plexId: string;
  username: string;
  isAdmin: boolean;
}

export interface MediaItemWithVote extends MediaItem {
  vote: VoteValue | null;
  keepSeasons: number | null;
  adminVote?: VoteValue | null;
  adminKeepSeasons?: number | null;
  watchStatus: {
    watched: boolean;
    playCount: number;
    lastWatchedAt: string | null;
  } | null;
}

export interface ReviewCompletionSummary {
  totalParticipants: number;
  nominationsComplete: number;
  votingComplete: number;
  users: {
    username: string;
    nominationsComplete: boolean;
    votingComplete: boolean;
    nominationsCompletedAt: string | null;
    votingCompletedAt: string | null;
  }[];
}

export interface CommunityCandidate {
  id: number;
  title: string;
  mediaType: "movie" | "tv";
  posterPath: string | null;
  status: MediaStatus;
  tmdbId: number | null;
  tvdbId: number | null;
  imdbId: string | null;
  overseerrId: number | null;
  requestedByUsername: string;
  requestedAt: string | null;
  seasonCount: number | null;
  availableSeasonCount: number | null;
  nominationType: "delete" | "trim";
  keepSeasons: number | null;
  watchStatus: {
    watched: boolean;
    playCount: number;
    lastWatchedAt: string | null;
  } | null;
  tally: { keepCount: number };
  currentUserVote: CommunityVoteValue | null;
  isRequestor: boolean;
  isNominator: boolean;
}
