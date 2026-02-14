import { db } from "@/lib/db";
import {
  mediaItems,
  userVotes,
  watchStatus,
  users,
  communityVotes,
  reviewActions,
} from "@/lib/db/schema";
import { eq, and, count, or, ne, inArray, sql, type SQL } from "drizzle-orm";

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
  availableSeasonCount: mediaItems.availableSeasonCount,
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
    availableSeasonCount: i.availableSeasonCount || null,
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

/**
 * Shared candidate query for review rounds.
 * Returns nominated media items with community vote tallies, admin actions,
 * and the acting admin's username.
 */
export async function getCandidatesForRound(roundId: number) {
  const keepCountSub = db
    .select({
      mediaItemId: communityVotes.mediaItemId,
      cnt: count().as("keep_count"),
    })
    .from(communityVotes)
    .where(eq(communityVotes.vote, "keep"))
    .groupBy(communityVotes.mediaItemId)
    .as("keep_tally");

  const actionSubquery = db
    .select({
      mediaItemId: reviewActions.mediaItemId,
      action: reviewActions.action,
      actedByPlexId: reviewActions.actedByPlexId,
      actedAt: reviewActions.actedAt,
    })
    .from(reviewActions)
    .where(eq(reviewActions.reviewRoundId, roundId))
    .as("round_action");

  const actionByUser = db
    .select({
      plexId: users.plexId,
      username: users.username,
    })
    .from(users)
    .as("action_by_user");

  const baseCondition = getNominationCondition();

  // Prefer self-nomination over admin nomination for type and keepSeasons
  const selfPreferredVote = sql<string>`COALESCE(
    MAX(CASE WHEN ${userVotes.userPlexId} = ${mediaItems.requestedByPlexId} THEN ${userVotes.vote} END),
    MAX(${userVotes.vote})
  )`.as("nomination_type");

  const selfPreferredKeepSeasons = sql<number | null>`COALESCE(
    MAX(CASE WHEN ${userVotes.userPlexId} = ${mediaItems.requestedByPlexId} THEN ${userVotes.keepSeasons} END),
    MAX(${userVotes.keepSeasons})
  )`.as("keep_seasons_agg");

  // Build a subquery to resolve nominator usernames
  const nominatorUser = db
    .select({
      plexId: users.plexId,
      username: users.username,
    })
    .from(users)
    .as("nominator_user");

  // Collect distinct nominator usernames (comma-separated if multiple)
  const nominatedByUsernames = sql<string>`GROUP_CONCAT(DISTINCT ${nominatorUser.username})`.as(
    "nominated_by_usernames"
  );

  return db
    .select({
      id: mediaItems.id,
      title: mediaItems.title,
      mediaType: mediaItems.mediaType,
      status: mediaItems.status,
      posterPath: mediaItems.posterPath,
      requestedByUsername: users.username,
      nominatedByUsernames,
      seasonCount: mediaItems.seasonCount,
      availableSeasonCount: mediaItems.availableSeasonCount,
      nominationType: selfPreferredVote,
      keepSeasons: selfPreferredKeepSeasons,
      keepCount: keepCountSub.cnt,
      action: actionSubquery.action,
      actedAt: actionSubquery.actedAt,
      actionByUsername: actionByUser.username,
      updatedAt: mediaItems.updatedAt,
    })
    .from(mediaItems)
    .innerJoin(userVotes, baseCondition!)
    .leftJoin(users, eq(users.plexId, mediaItems.requestedByPlexId))
    .leftJoin(nominatorUser, eq(nominatorUser.plexId, userVotes.userPlexId))
    .leftJoin(keepCountSub, eq(keepCountSub.mediaItemId, mediaItems.id))
    .leftJoin(actionSubquery, eq(actionSubquery.mediaItemId, mediaItems.id))
    .leftJoin(actionByUser, eq(actionByUser.plexId, actionSubquery.actedByPlexId))
    .groupBy(mediaItems.id)
    .orderBy(
      sql`CASE WHEN ${mediaItems.status} = 'removed' THEN 1 ELSE 0 END ASC`,
      sql`COALESCE(${keepCountSub.cnt}, 0) DESC`,
      mediaItems.mediaType,
      mediaItems.title
    );
}
