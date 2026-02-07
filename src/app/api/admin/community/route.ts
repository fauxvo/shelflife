import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/auth/middleware";
import { communityQuerySchema } from "@/lib/validators/schemas";
import { buildPagination } from "@/lib/db/queries";
import { db } from "@/lib/db";
import { mediaItems, userVotes, communityVotes, watchStatus, users } from "@/lib/db/schema";
import { eq, and, count, sql, inArray } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const params = Object.fromEntries(request.nextUrl.searchParams);
    const query = communityQuerySchema.parse(params);

    const offset = (query.page - 1) * query.limit;

    // Base condition: requestor self-nominated for deletion or trim
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

    let baseQuery = db
      .select({
        id: mediaItems.id,
        title: mediaItems.title,
        mediaType: mediaItems.mediaType,
        posterPath: mediaItems.posterPath,
        status: mediaItems.status,
        imdbId: mediaItems.imdbId,
        requestedAt: mediaItems.requestedAt,
        requestedByPlexId: mediaItems.requestedByPlexId,
        requestedByUsername: users.username,
        seasonCount: mediaItems.seasonCount,
        nominationType: userVotes.vote,
        keepSeasons: userVotes.keepSeasons,
        watched: watchStatus.watched,
        playCount: watchStatus.playCount,
        lastWatchedAt: watchStatus.lastWatchedAt,
        keepCount: keepCountSub.cnt,
        removeCount: removeCountSub.cnt,
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
      .leftJoin(removeCountSub, eq(removeCountSub.mediaItemId, mediaItems.id));

    if (query.type !== "all") {
      baseQuery = baseQuery.where(eq(mediaItems.mediaType, query.type)) as typeof baseQuery;
    }

    // Sort by consensus strength (remove - keep DESC) for admin
    baseQuery = baseQuery.orderBy(
      sql`(COALESCE(${removeCountSub.cnt}, 0) - COALESCE(${keepCountSub.cnt}, 0)) DESC`
    ) as typeof baseQuery;

    const items = await baseQuery.limit(query.limit).offset(offset);

    // Count
    let countQuery = db
      .select({ total: count() })
      .from(mediaItems)
      .innerJoin(userVotes, baseCondition!);

    if (query.type !== "all") {
      countQuery = countQuery.where(eq(mediaItems.mediaType, query.type)) as typeof countQuery;
    }

    const totalResult = await countQuery;
    const total = totalResult[0]?.total || 0;

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
        voters: voterBreakdown[i.id] || [],
      })),
      pagination: buildPagination(query.page, query.limit, total),
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
