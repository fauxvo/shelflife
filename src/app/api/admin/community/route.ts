import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/auth/middleware";
import { communityQuerySchema } from "@/lib/validators/schemas";
import {
  buildPagination,
  getNominationCondition,
  getActiveRound,
  baseMediaColumns,
  watchStatusColumns,
  mapBaseMediaFields,
  mapWatchStatus,
} from "@/lib/db/queries";
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

    // Gate on active review round — no community content outside of rounds
    const activeRound = await getActiveRound();

    if (!activeRound) {
      return NextResponse.json({
        items: [],
        pagination: buildPagination(query.page, query.limit, 0),
      });
    }

    const offset = (query.page - 1) * query.limit;
    const activeRoundId = activeRound.id;

    // Base condition: items nominated for deletion/trim in this round
    const baseCondition = getNominationCondition(activeRoundId);

    // Tally subqueries — scoped to active round
    const keepCountSub = db
      .select({
        mediaItemId: communityVotes.mediaItemId,
        cnt: count().as("keep_count"),
      })
      .from(communityVotes)
      .where(and(eq(communityVotes.vote, "keep"), eq(communityVotes.reviewRoundId, activeRoundId)))
      .groupBy(communityVotes.mediaItemId)
      .as("keep_tally");

    // Aggregate nomination type: explicit ordinal weights ensure 'trim' (more specific) wins
    // over 'delete' regardless of alphabetic collation. Matches getCandidatesForRound pattern.
    const aggregatedVote = sql<string>`
      CASE MAX(CASE ${userVotes.vote} WHEN 'trim' THEN 2 WHEN 'delete' THEN 1 ELSE 0 END)
        WHEN 2 THEN 'trim'
        WHEN 1 THEN 'delete'
        ELSE 'delete'
      END`.as("nomination_type");
    const aggregatedKeepSeasons = sql<number | null>`MAX(${userVotes.keepSeasons})`.as(
      "keep_seasons_agg"
    );

    let baseQuery = db
      .select({
        ...baseMediaColumns,
        ...watchStatusColumns,
        requestedByUsername: users.username,
        nominationType: aggregatedVote,
        keepSeasons: aggregatedKeepSeasons,
        keepCount: keepCountSub.cnt,
      })
      .from(mediaItems)
      .innerJoin(userVotes, baseCondition)
      .leftJoin(users, eq(users.plexId, mediaItems.requestedByPlexId))
      // Intentional: admin view shows the requester's watch status (not the admin's),
      // so admins can see whether the person who requested the content has watched it.
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
    } else if (query.sort === "most_keep") {
      baseQuery = baseQuery.orderBy(sql`COALESCE(${keepCountSub.cnt}, 0) DESC`) as typeof baseQuery;
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
      .innerJoin(userVotes, baseCondition)
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
        .where(
          and(
            inArray(communityVotes.mediaItemId, itemIds),
            eq(communityVotes.reviewRoundId, activeRoundId)
          )
        );

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
        ...mapBaseMediaFields(i),
        requestedByUsername: i.requestedByUsername || null,
        nominationType: (i.nominationType === "trim" ? "trim" : "delete") as "delete" | "trim",
        keepSeasons: i.keepSeasons ? Number(i.keepSeasons) : null,
        watchStatus: mapWatchStatus(i),
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
