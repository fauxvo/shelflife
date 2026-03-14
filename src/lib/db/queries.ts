import { db } from "@/lib/db";
import {
  mediaItems,
  userVotes,
  watchStatus,
  users,
  communityVotes,
  reviewActions,
  reviewRounds,
} from "@/lib/db/schema";
import { eq, and, count, ne, inArray, sql, type SQL } from "drizzle-orm";

/**
 * Fetch the currently active review round.
 * Returns { id } or null if no round is active.
 */
export async function getActiveRound(): Promise<{ id: number } | null> {
  const rows = await db
    .select({ id: reviewRounds.id })
    .from(reviewRounds)
    .where(eq(reviewRounds.status, "active"))
    .limit(1);
  return rows[0] ?? null;
}

/** Base media item columns — reusable across any query that selects from mediaItems. */
export const baseMediaColumns = {
  id: mediaItems.id,
  overseerrId: mediaItems.overseerrId,
  tmdbId: mediaItems.tmdbId,
  tvdbId: mediaItems.tvdbId,
  imdbId: mediaItems.imdbId,
  mediaType: mediaItems.mediaType,
  title: mediaItems.title,
  posterPath: mediaItems.posterPath,
  status: mediaItems.status,
  requestedAt: mediaItems.requestedAt,
  requestedByPlexId: mediaItems.requestedByPlexId,
  ratingKey: mediaItems.ratingKey,
  seasonCount: mediaItems.seasonCount,
  availableSeasonCount: mediaItems.availableSeasonCount,
  fileSize: mediaItems.fileSize,
  addedAt: mediaItems.addedAt,
};

/** Watch status columns for LEFT JOIN on watchStatus table. */
export const watchStatusColumns = {
  watched: watchStatus.watched,
  playCount: watchStatus.playCount,
  lastWatchedAt: watchStatus.lastWatchedAt,
};

const mediaItemColumns = {
  ...baseMediaColumns,
  vote: userVotes.vote,
  keepSeasons: userVotes.keepSeasons,
  ...watchStatusColumns,
  requestedByUsername: users.username,
};

export function mediaQueryWithJoins(plexId: string, roundId?: number) {
  const voteConditions = [
    eq(userVotes.mediaItemId, mediaItems.id),
    eq(userVotes.userPlexId, plexId),
  ];
  if (roundId !== undefined) {
    voteConditions.push(eq(userVotes.reviewRoundId, roundId));
  }

  return db
    .select(mediaItemColumns)
    .from(mediaItems)
    .leftJoin(userVotes, and(...voteConditions))
    .leftJoin(
      watchStatus,
      and(eq(watchStatus.mediaItemId, mediaItems.id), eq(watchStatus.userPlexId, plexId))
    )
    .leftJoin(users, eq(users.plexId, mediaItems.requestedByPlexId));
}

export function mediaCountWithJoins(plexId: string, roundId?: number) {
  const voteConditions = [
    eq(userVotes.mediaItemId, mediaItems.id),
    eq(userVotes.userPlexId, plexId),
  ];
  if (roundId !== undefined) {
    voteConditions.push(eq(userVotes.reviewRoundId, roundId));
  }

  return db
    .select({ total: count() })
    .from(mediaItems)
    .leftJoin(userVotes, and(...voteConditions))
    .leftJoin(
      watchStatus,
      and(eq(watchStatus.mediaItemId, mediaItems.id), eq(watchStatus.userPlexId, plexId))
    );
}

/** Input shape expected by mapBaseMediaFields — must include at least the base media columns. */
type BaseMediaRow = { [K in keyof typeof baseMediaColumns]: unknown };

/** Maps base media item fields to a consistent response shape. Reuse in any route. */
export function mapBaseMediaFields(i: BaseMediaRow & Record<string, unknown>) {
  return {
    id: i.id,
    overseerrId: i.overseerrId ?? null,
    tmdbId: i.tmdbId,
    tvdbId: i.tvdbId ?? null,
    imdbId: i.imdbId,
    mediaType: i.mediaType,
    title: i.title,
    posterPath: i.posterPath,
    status: i.status,
    requestedAt: i.requestedAt,
    ratingKey: i.ratingKey,
    seasonCount: i.seasonCount ?? null,
    availableSeasonCount: i.availableSeasonCount ?? null,
    fileSize: i.fileSize ?? null,
    addedAt: i.addedAt ?? null,
  };
}

/** Input shape expected by mapWatchStatus — must include at least the watch status columns. */
type WatchStatusRow = { watched: unknown; playCount: unknown; lastWatchedAt: unknown };

/** Maps watch status columns to the standard watchStatus response shape. */
export function mapWatchStatus(i: WatchStatusRow & Record<string, unknown>) {
  return i.watched !== null && i.watched !== undefined
    ? {
        watched: !!i.watched,
        playCount: (i.playCount as number) || 0,
        lastWatchedAt: i.lastWatchedAt as string | null,
      }
    : null;
}

export function mapMediaItemRow(
  i: typeof mediaItemColumns extends infer T ? { [K in keyof T]: any } : never
) {
  return {
    ...mapBaseMediaFields(i),
    requestedByUsername: i.requestedByUsername || null,
    vote: i.vote || null,
    keepSeasons: i.keepSeasons || null,
    watchStatus: mapWatchStatus(i),
  };
}

/**
 * Shared condition for community nomination queries.
 * An item is nominated if any user voted delete/trim on it.
 * With *arr-sourced content, items may have no requester — any nomination counts.
 * When roundId is provided, scopes to that round's nominations only.
 */
export function getNominationCondition(roundId?: number): SQL {
  const conditions = [
    eq(userVotes.mediaItemId, mediaItems.id),
    inArray(userVotes.vote, ["delete", "trim"]),
  ];
  if (roundId !== undefined) {
    conditions.push(eq(userVotes.reviewRoundId, roundId));
  }
  // and() with concrete args always returns SQL, never undefined
  return and(...conditions)!;
}

/**
 * Shared stats computation used by both the stats API endpoint
 * and the dashboard page server-side rendering.
 */
export async function computeMediaStats(
  plexId: string,
  scope: "personal" | "all",
  roundId?: number
) {
  const scopeCondition: SQL | undefined =
    scope === "personal" ? eq(mediaItems.requestedByPlexId, plexId) : undefined;

  const [totalResult] = await db
    .select({ total: count() })
    .from(mediaItems)
    .where(and(ne(mediaItems.status, "removed"), scopeCondition));

  const voteJoinConditions = [
    eq(userVotes.mediaItemId, mediaItems.id),
    eq(userVotes.userPlexId, plexId),
  ];
  if (roundId !== undefined) {
    voteJoinConditions.push(eq(userVotes.reviewRoundId, roundId));
  }

  const [nominatedResult] = await db
    .select({ total: count() })
    .from(mediaItems)
    .innerJoin(userVotes, and(...voteJoinConditions))
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
  const keepVoterUser = db
    .select({ plexId: users.plexId, username: users.username })
    .from(users)
    .as("keep_voter_user");

  const keepTallySub = db
    .select({
      mediaItemId: communityVotes.mediaItemId,
      cnt: count().as("keep_count"),
      voterUsernames: sql<string>`GROUP_CONCAT(DISTINCT ${keepVoterUser.username})`.as(
        "voter_usernames"
      ),
    })
    .from(communityVotes)
    .innerJoin(keepVoterUser, eq(keepVoterUser.plexId, communityVotes.userPlexId))
    .where(and(eq(communityVotes.vote, "keep"), eq(communityVotes.reviewRoundId, roundId)))
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

  const baseCondition = getNominationCondition(roundId);

  // Aggregate nomination type: with open nominations, multiple users may nominate the same
  // item with different types. Explicit ordinal weights ensure 'trim' (more specific) wins
  // over 'delete' regardless of alphabetic collation. Tradeoff: if one user wants full
  // deletion and another wants trim, the admin sees "trim" — the delete request is not
  // surfaced. This favors data preservation; admins can still choose to delete.
  const aggregatedVote = sql<string>`
    CASE MAX(CASE ${userVotes.vote} WHEN 'trim' THEN 2 WHEN 'delete' THEN 1 ELSE 0 END)
      WHEN 2 THEN 'trim'
      WHEN 1 THEN 'delete'
      ELSE 'delete'
    END`.as("nomination_type");

  const aggregatedKeepSeasons = sql<number | null>`MAX(${userVotes.keepSeasons})`.as(
    "keep_seasons_agg"
  );

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
      ...baseMediaColumns,
      requestedByUsername: users.username,
      nominatedByUsernames,
      nominationType: aggregatedVote,
      keepSeasons: aggregatedKeepSeasons,
      keepCount: keepTallySub.cnt,
      keepVoterUsernames: keepTallySub.voterUsernames,
      action: actionSubquery.action,
      actedAt: actionSubquery.actedAt,
      actionByUsername: actionByUser.username,
      updatedAt: mediaItems.updatedAt,
    })
    .from(mediaItems)
    .innerJoin(userVotes, baseCondition)
    .leftJoin(users, eq(users.plexId, mediaItems.requestedByPlexId))
    .leftJoin(nominatorUser, eq(nominatorUser.plexId, userVotes.userPlexId))
    .leftJoin(keepTallySub, eq(keepTallySub.mediaItemId, mediaItems.id))
    .leftJoin(actionSubquery, eq(actionSubquery.mediaItemId, mediaItems.id))
    .leftJoin(actionByUser, eq(actionByUser.plexId, actionSubquery.actedByPlexId))
    .groupBy(mediaItems.id)
    .orderBy(
      sql`CASE WHEN ${mediaItems.status} = 'removed' THEN 1 ELSE 0 END ASC`,
      sql`COALESCE(${keepTallySub.cnt}, 0) DESC`,
      mediaItems.mediaType,
      mediaItems.title
    );
}
