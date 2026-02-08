import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import { communityQuerySchema } from "@/lib/validators/schemas";
import { buildPagination, getNominationCondition } from "@/lib/db/queries";
import { db } from "@/lib/db";
import { mediaItems, userVotes, communityVotes, watchStatus, users } from "@/lib/db/schema";
import { eq, and, count, sql, isNull, desc } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { getCommonSortOrder, DEFAULT_SORT_ORDER } from "@/lib/db/sorting";

async function getCandidateCount(
  dbInstance: typeof db,
  baseCondition: SQL,
  query: { type: string; unvoted?: string },
  plexId: string
): Promise<number> {
  const whereConditions: SQL[] = [];

  if (query.type !== "all") {
    whereConditions.push(eq(mediaItems.mediaType, query.type as "movie" | "tv"));
  }

  // Use LEFT JOIN + IS NULL to match the main query's unvoted filtering
  const userCvCount = dbInstance
    .select({
      mediaItemId: communityVotes.mediaItemId,
      vote: communityVotes.vote,
    })
    .from(communityVotes)
    .where(eq(communityVotes.userPlexId, plexId))
    .as("user_cv_count");

  if (query.unvoted === "true") {
    whereConditions.push(isNull(userCvCount.vote));
  }

  const result = await dbInstance
    .select({ total: sql<number>`COUNT(DISTINCT ${mediaItems.id})` })
    .from(mediaItems)
    .innerJoin(userVotes, baseCondition)
    .leftJoin(userCvCount, eq(userCvCount.mediaItemId, mediaItems.id))
    .where(and(...whereConditions));

  return Number(result[0]?.total) || 0;
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    const params = Object.fromEntries(request.nextUrl.searchParams);
    const query = communityQuerySchema.parse(params);

    const offset = (query.page - 1) * query.limit;

    // Base query: items nominated for deletion/trim (self-nominated or admin-nominated)
    const baseCondition = getNominationCondition();

    // Tally subqueries — separate counts avoid raw SQL SUM(CASE WHEN)
    const keepCountSub = db
      .select({
        mediaItemId: communityVotes.mediaItemId,
        cnt: count().as("keep_count"),
      })
      .from(communityVotes)
      .where(eq(communityVotes.vote, "keep"))
      .groupBy(communityVotes.mediaItemId)
      .as("keep_tally");

    // Current user's community vote
    const userCommunityVote = db
      .select({
        mediaItemId: communityVotes.mediaItemId,
        vote: communityVotes.vote,
      })
      .from(communityVotes)
      .where(eq(communityVotes.userPlexId, session.plexId))
      .as("user_cv");

    // Use aggregates to resolve GROUP BY when both self + admin nominate the same item.
    // COALESCE prefers the self-nomination; MAX() fallback is deterministic in SQLite
    // (alphabetical: 'trim' > 'delete'), which correctly preserves the more specific vote.
    // These use Drizzle column refs (parameterized), not string interpolation — safe from injection.
    const selfPreferredVote = sql<string>`COALESCE(
      MAX(CASE WHEN ${userVotes.userPlexId} = ${mediaItems.requestedByPlexId} THEN ${userVotes.vote} END),
      MAX(${userVotes.vote})
    )`.as("nomination_type");

    const selfPreferredKeepSeasons = sql<number | null>`COALESCE(
      MAX(CASE WHEN ${userVotes.userPlexId} = ${mediaItems.requestedByPlexId} THEN ${userVotes.keepSeasons} END),
      MAX(${userVotes.keepSeasons})
    )`.as("keep_seasons_agg");

    const isNominator =
      sql<number>`MAX(CASE WHEN ${userVotes.userPlexId} = ${session.plexId} THEN 1 ELSE 0 END)`.as(
        "is_nominator"
      );

    let baseQuery = db
      .select({
        id: mediaItems.id,
        title: mediaItems.title,
        mediaType: mediaItems.mediaType,
        posterPath: mediaItems.posterPath,
        status: mediaItems.status,
        tmdbId: mediaItems.tmdbId,
        imdbId: mediaItems.imdbId,
        requestedAt: mediaItems.requestedAt,
        requestedByUsername: users.username,
        seasonCount: mediaItems.seasonCount,
        nominationType: selfPreferredVote,
        keepSeasons: selfPreferredKeepSeasons,
        watched: watchStatus.watched,
        playCount: watchStatus.playCount,
        lastWatchedAt: watchStatus.lastWatchedAt,
        keepCount: keepCountSub.cnt,
        currentUserVote: userCommunityVote.vote,
        selfVoteUpdatedAt: sql<string>`MAX(${userVotes.updatedAt})`.as("self_vote_updated_at"),
        requestedByPlexId: mediaItems.requestedByPlexId,
        isNominator,
      })
      .from(mediaItems)
      .innerJoin(userVotes, baseCondition!)
      .leftJoin(users, eq(users.plexId, mediaItems.requestedByPlexId))
      .leftJoin(
        watchStatus,
        and(
          eq(watchStatus.mediaItemId, mediaItems.id),
          eq(watchStatus.userPlexId, mediaItems.requestedByPlexId)
        )
      )
      .leftJoin(keepCountSub, eq(keepCountSub.mediaItemId, mediaItems.id))
      .leftJoin(userCommunityVote, eq(userCommunityVote.mediaItemId, mediaItems.id));

    // Build WHERE conditions — optional filters
    const whereConditions: SQL[] = [];

    if (query.type !== "all") {
      whereConditions.push(eq(mediaItems.mediaType, query.type));
    }
    if (query.unvoted === "true") {
      whereConditions.push(isNull(userCommunityVote.vote));
    }

    baseQuery = baseQuery.where(and(...whereConditions)) as typeof baseQuery;

    // Apply sorting
    const commonSort = getCommonSortOrder(query.sort);
    if (commonSort) {
      baseQuery = baseQuery.orderBy(commonSort) as typeof baseQuery;
    } else if (query.sort === "least_keep") {
      baseQuery = baseQuery.orderBy(sql`COALESCE(${keepCountSub.cnt}, 0) ASC`) as typeof baseQuery;
    } else if (query.sort === "oldest_unwatched") {
      baseQuery = baseQuery.orderBy(
        sql`${watchStatus.lastWatchedAt} ASC NULLS FIRST`
      ) as typeof baseQuery;
    } else if (query.sort === "newest") {
      baseQuery = baseQuery.orderBy(desc(userVotes.updatedAt)) as typeof baseQuery;
    } else {
      baseQuery = baseQuery.orderBy(DEFAULT_SORT_ORDER) as typeof baseQuery;
    }

    // GROUP BY to deduplicate when both self + admin nominate the same item
    const items = await baseQuery.groupBy(mediaItems.id).limit(query.limit).offset(offset);

    // Count query — separate paths to keep Drizzle types clean
    const total = await getCandidateCount(db, baseCondition!, query, session.plexId);

    return NextResponse.json({
      items: items.map((i) => ({
        id: i.id,
        title: i.title,
        mediaType: i.mediaType,
        posterPath: i.posterPath,
        status: i.status,
        tmdbId: i.tmdbId,
        imdbId: i.imdbId,
        requestedByUsername: i.requestedByUsername || "Unknown",
        requestedAt: i.requestedAt,
        seasonCount: i.seasonCount || null,
        nominationType: (i.nominationType === "trim" ? "trim" : "delete") as "delete" | "trim",
        keepSeasons: i.keepSeasons ? Number(i.keepSeasons) : null,
        watchStatus:
          i.watched !== null && i.watched !== undefined
            ? {
                watched: !!i.watched,
                playCount: i.playCount || 0,
                lastWatchedAt: i.lastWatchedAt,
              }
            : null,
        tally: {
          keepCount: Number(i.keepCount) || 0,
        },
        currentUserVote: i.currentUserVote || null,
        isRequestor: i.requestedByPlexId === session.plexId,
        isNominator: !!i.isNominator,
      })),
      pagination: buildPagination(query.page, query.limit, total),
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
