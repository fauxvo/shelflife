import { db } from "@/lib/db";
import { mediaItems, userVotes, watchStatus, users } from "@/lib/db/schema";
import { eq, and, count, or, ne, inArray, type SQL } from "drizzle-orm";

const mediaItemColumns = {
  id: mediaItems.id,
  overseerrId: mediaItems.overseerrId,
  tmdbId: mediaItems.tmdbId,
  imdbId: mediaItems.imdbId,
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
    imdbId: i.imdbId,
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

/**
 * Shared condition for community nomination queries.
 * An item is nominated if someone voted delete/trim AND
 * the voter is the requestor OR the voter is an admin.
 */
export function getNominationCondition() {
  return and(
    eq(userVotes.mediaItemId, mediaItems.id),
    inArray(userVotes.vote, ["delete", "trim"]),
    or(
      eq(userVotes.userPlexId, mediaItems.requestedByPlexId),
      inArray(
        userVotes.userPlexId,
        db.select({ plexId: users.plexId }).from(users).where(eq(users.isAdmin, true))
      )
    )
  );
}

/**
 * Shared stats computation used by both the stats API endpoint
 * and the dashboard page server-side rendering.
 */
export async function computeMediaStats(plexId: string, scope: "personal" | "all") {
  const scopeCondition: SQL | undefined =
    scope === "personal" ? eq(mediaItems.requestedByPlexId, plexId) : undefined;

  const [totalResult] = await db
    .select({ total: count() })
    .from(mediaItems)
    .where(and(ne(mediaItems.status, "removed"), scopeCondition));

  const [nominatedResult] = await db
    .select({ total: count() })
    .from(mediaItems)
    .innerJoin(
      userVotes,
      and(eq(userVotes.mediaItemId, mediaItems.id), eq(userVotes.userPlexId, plexId))
    )
    .where(
      and(
        ne(mediaItems.status, "removed"),
        inArray(userVotes.vote, ["delete", "trim"]),
        scopeCondition
      )
    );

  const [watchedResult] = await db
    .select({ total: count() })
    .from(mediaItems)
    .innerJoin(
      watchStatus,
      and(eq(watchStatus.mediaItemId, mediaItems.id), eq(watchStatus.userPlexId, plexId))
    )
    .where(and(ne(mediaItems.status, "removed"), eq(watchStatus.watched, true), scopeCondition));

  const total = totalResult?.total || 0;
  const nominated = nominatedResult?.total || 0;

  return {
    total,
    nominated,
    notNominated: total - nominated,
    watched: watchedResult?.total || 0,
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
