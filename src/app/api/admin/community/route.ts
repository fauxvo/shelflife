import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/auth/middleware";
import { communityQuerySchema } from "@/lib/validators/schemas";
import { buildPagination, getNominationCondition } from "@/lib/db/queries";
import { db } from "@/lib/db";
import { mediaItems, userVotes, communityVotes, watchStatus, users } from "@/lib/db/schema";
import { eq, and, count, sql, desc, inArray } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { getCommonSortOrder, DEFAULT_SORT_ORDER } from "@/lib/db/sorting";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const params = Object.fromEntries(request.nextUrl.searchParams);
    const query = communityQuerySchema.parse(params);

    const offset = (query.page - 1) * query.limit;

    // Base condition: items nominated for deletion/trim (self-nominated or admin-nominated)
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

    // Use aggregates to resolve GROUP BY non-determinism:
    // Prefer self-nomination over admin nomination for type and keepSeasons
    const selfPreferredVote = sql<string>`COALESCE(
      MAX(CASE WHEN ${userVotes.userPlexId} = ${mediaItems.requestedByPlexId} THEN ${userVotes.vote} END),
      MAX(${userVotes.vote})
    )`.as("nomination_type");

    const selfPreferredKeepSeasons = sql<number | null>`COALESCE(
      MAX(CASE WHEN ${userVotes.userPlexId} = ${mediaItems.requestedByPlexId} THEN ${userVotes.keepSeasons} END),
      MAX(${userVotes.keepSeasons})
    )`.as("keep_seasons_agg");

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
        requestedByPlexId: mediaItems.requestedByPlexId,
        requestedByUsername: users.username,
        seasonCount: mediaItems.seasonCount,
        nominationType: selfPreferredVote,
        keepSeasons: selfPreferredKeepSeasons,
        watched: watchStatus.watched,
        playCount: watchStatus.playCount,
        lastWatchedAt: watchStatus.lastWatchedAt,
        keepCount: keepCountSub.cnt,
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
      .leftJoin(keepCountSub, eq(keepCountSub.mediaItemId, mediaItems.id));

    const adminWhere: SQL[] = [];
    if (query.type !== "all") {
      adminWhere.push(eq(mediaItems.mediaType, query.type));
    }
    baseQuery = baseQuery.where(and(...adminWhere)) as typeof baseQuery;

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

    // Count
    const countWhere: SQL[] = [];
    if (query.type !== "all") {
      countWhere.push(eq(mediaItems.mediaType, query.type));
    }
    const countQuery = db
      .select({ total: sql<number>`COUNT(DISTINCT ${mediaItems.id})` })
      .from(mediaItems)
      .innerJoin(userVotes, baseCondition!)
      .where(and(...countWhere));

    const totalResult = await countQuery;
    const total = Number(totalResult[0]?.total) || 0;

    // Get voter breakdown per item
    const itemIds = items.map((i) => i.id);
    const voterBreakdown: Record<
      number,
      Array<{ username: string; vote: string; votedAt: string }>
    > = {};

    if (itemIds.length > 0) {
      const votes = await db
        .select({
          mediaItemId: communityVotes.mediaItemId,
          username: users.username,
          vote: communityVotes.vote,
          votedAt: communityVotes.updatedAt,
        })
        .from(communityVotes)
        .leftJoin(users, eq(users.plexId, communityVotes.userPlexId))
        .where(inArray(communityVotes.mediaItemId, itemIds));

      for (const v of votes) {
        if (!voterBreakdown[v.mediaItemId]) {
          voterBreakdown[v.mediaItemId] = [];
        }
        voterBreakdown[v.mediaItemId].push({
          username: v.username || "Unknown",
          vote: v.vote,
          votedAt: v.votedAt,
        });
      }
    }

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
        voters: voterBreakdown[i.id] || [],
      })),
      pagination: buildPagination(query.page, query.limit, total),
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
