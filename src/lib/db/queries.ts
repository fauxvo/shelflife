import { db } from "@/lib/db";
import { mediaItems, userVotes, watchStatus } from "@/lib/db/schema";
import { eq, and, count } from "drizzle-orm";

const mediaItemColumns = {
  id: mediaItems.id,
  overseerrId: mediaItems.overseerrId,
  tmdbId: mediaItems.tmdbId,
  mediaType: mediaItems.mediaType,
  title: mediaItems.title,
  posterPath: mediaItems.posterPath,
  status: mediaItems.status,
  requestedAt: mediaItems.requestedAt,
  ratingKey: mediaItems.ratingKey,
  seasonCount: mediaItems.seasonCount,
  vote: userVotes.vote,
  keepSeasons: userVotes.keepSeasons,
  watched: watchStatus.watched,
  playCount: watchStatus.playCount,
  lastWatchedAt: watchStatus.lastWatchedAt,
};

export function mediaQueryWithJoins(plexId: string) {
  return db
    .select(mediaItemColumns)
    .from(mediaItems)
    .leftJoin(
      userVotes,
      and(eq(userVotes.mediaItemId, mediaItems.id), eq(userVotes.userPlexId, plexId))
    )
    .leftJoin(
      watchStatus,
      and(eq(watchStatus.mediaItemId, mediaItems.id), eq(watchStatus.userPlexId, plexId))
    );
}

export function mediaCountWithJoins(plexId: string) {
  return db
    .select({ total: count() })
    .from(mediaItems)
    .leftJoin(
      userVotes,
      and(eq(userVotes.mediaItemId, mediaItems.id), eq(userVotes.userPlexId, plexId))
    )
    .leftJoin(
      watchStatus,
      and(eq(watchStatus.mediaItemId, mediaItems.id), eq(watchStatus.userPlexId, plexId))
    );
}

export function mapMediaItemRow(
  i: typeof mediaItemColumns extends infer T ? { [K in keyof T]: any } : never
) {
  return {
    id: i.id,
    overseerrId: i.overseerrId,
    tmdbId: i.tmdbId,
    mediaType: i.mediaType,
    title: i.title,
    posterPath: i.posterPath,
    status: i.status,
    requestedAt: i.requestedAt,
    ratingKey: i.ratingKey,
    seasonCount: i.seasonCount || null,
    vote: i.vote || null,
    keepSeasons: i.keepSeasons || null,
    watchStatus:
      i.watched !== null
        ? {
            watched: i.watched,
            playCount: i.playCount || 0,
            lastWatchedAt: i.lastWatchedAt,
          }
        : null,
  };
}

export function buildPagination(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
  };
}
