import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import { communityQuerySchema } from "@/lib/validators/schemas";
import { buildPagination } from "@/lib/db/queries";
import { db } from "@/lib/db";
import { mediaItems, userVotes, communityVotes, watchStatus, users } from "@/lib/db/schema";
import { eq, and, count, sql, isNull, desc, inArray } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

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
    .select({ total: count() })
    .from(mediaItems)
    .innerJoin(userVotes, baseCondition)
    .leftJoin(userCvCount, eq(userCvCount.mediaItemId, mediaItems.id))
    .where(and(...whereConditions));

  return result[0]?.total || 0;
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    const params = Object.fromEntries(request.nextUrl.searchParams);
    const query = communityQuerySchema.parse(params);

    const offset = (query.page - 1) * query.limit;

    // Base query: items where the requestor voted "delete" or "trim" on their own item
    const baseCondition = and(
      eq(userVotes.mediaItemId, mediaItems.id),
      eq(userVotes.userPlexId, mediaItems.requestedByPlexId),
      inArray(userVotes.vote, ["delete", "trim"])
    );

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

    const removeCountSub = db
      .select({
        mediaItemId: communityVotes.mediaItemId,
        cnt: count().as("remove_count"),
      })
      .from(communityVotes)
      .where(eq(communityVotes.vote, "remove"))
      .groupBy(communityVotes.mediaItemId)
      .as("remove_tally");

    // Current user's community vote
    const userCommunityVote = db
      .select({
        mediaItemId: communityVotes.mediaItemId,
        vote: communityVotes.vote,
      })
      .from(communityVotes)
      .where(eq(communityVotes.userPlexId, session.plexId))
      .as("user_cv");

    let baseQuery = db
      .select({
        id: mediaItems.id,
        title: mediaItems.title,
        mediaType: mediaItems.mediaType,
        posterPath: mediaItems.posterPath,
        status: mediaItems.status,
        imdbId: mediaItems.imdbId,
        requestedAt: mediaItems.requestedAt,
        requestedByUsername: users.username,
        seasonCount: mediaItems.seasonCount,
        nominationType: userVotes.vote,
        keepSeasons: userVotes.keepSeasons,
        watched: watchStatus.watched,
        playCount: watchStatus.playCount,
        lastWatchedAt: watchStatus.lastWatchedAt,
        keepCount: keepCountSub.cnt,
        removeCount: removeCountSub.cnt,
        currentUserVote: userCommunityVote.vote,
        selfVoteUpdatedAt: userVotes.updatedAt,
        requestedByPlexId: mediaItems.requestedByPlexId,
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
      .leftJoin(removeCountSub, eq(removeCountSub.mediaItemId, mediaItems.id))
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
    if (query.sort === "most_remove") {
      baseQuery = baseQuery.orderBy(desc(removeCountSub.cnt)) as typeof baseQuery;
    } else if (query.sort === "oldest_unwatched") {
      baseQuery = baseQuery.orderBy(
        sql`${watchStatus.lastWatchedAt} ASC NULLS FIRST`
      ) as typeof baseQuery;
    } else if (query.sort === "newest") {
      baseQuery = baseQuery.orderBy(desc(userVotes.updatedAt)) as typeof baseQuery;
    }

    const items = await baseQuery.limit(query.limit).offset(offset);

    // Count query — separate paths to keep Drizzle types clean
    const total = await getCandidateCount(db, baseCondition!, query, session.plexId);

    return NextResponse.json({
      items: items.map((i) => ({
        id: i.id,
        title: i.title,
        mediaType: i.mediaType,
        posterPath: i.posterPath,
        status: i.status,
        imdbId: i.imdbId,
        requestedByUsername: i.requestedByUsername || "Unknown",
        requestedAt: i.requestedAt,
        seasonCount: i.seasonCount || null,
        nominationType: (i.nominationType === "trim" ? "trim" : "delete") as "delete" | "trim",
        keepSeasons: i.keepSeasons || null,
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
          removeCount: Number(i.removeCount) || 0,
        },
        currentUserVote: i.currentUserVote || null,
        isOwn: i.requestedByPlexId === session.plexId,
      })),
      pagination: buildPagination(query.page, query.limit, total),
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
