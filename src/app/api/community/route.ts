import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
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
import { eq, and, count, sql, isNull, desc } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { getCommonSortOrder, DEFAULT_SORT_ORDER } from "@/lib/db/sorting";

async function getCandidateCount(
  dbInstance: typeof db,
  baseCondition: SQL,
  query: { type: string; unvoted?: string },
  plexId: string,
  roundId: number
): Promise<number> {
  const whereConditions: SQL[] = [];

  if (query.type !== "all") {
    whereConditions.push(eq(mediaItems.mediaType, query.type as "movie" | "tv"));
  }

  // Use LEFT JOIN + IS NULL to match the main query's unvoted filtering — scoped to active round
  const userCvCount = dbInstance
    .select({
      mediaItemId: communityVotes.mediaItemId,
      vote: communityVotes.vote,
    })
    .from(communityVotes)
    .where(and(eq(communityVotes.userPlexId, plexId), eq(communityVotes.reviewRoundId, roundId)))
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

    // Gate on active review round — community content only exists during rounds
    const activeRound = await getActiveRound();

    if (!activeRound) {
      return NextResponse.json({
        items: [],
        pagination: buildPagination(query.page, query.limit, 0),
      });
    }

    const offset = (query.page - 1) * query.limit;
    const activeRoundId = activeRound.id;

    // Base query: items nominated for deletion/trim in this round
    const baseCondition = getNominationCondition(activeRoundId);

    // Keep voter subquery — includes count and comma-separated voter names
    const keepVoterUser = db
      .select({ plexId: users.plexId, username: users.username })
      .from(users)
      .as("keep_voter_user");

    const keepCountSub = db
      .select({
        mediaItemId: communityVotes.mediaItemId,
        cnt: count().as("keep_count"),
        voterUsernames: sql<string>`GROUP_CONCAT(DISTINCT ${keepVoterUser.username})`.as(
          "keep_voter_usernames"
        ),
      })
      .from(communityVotes)
      .innerJoin(keepVoterUser, eq(keepVoterUser.plexId, communityVotes.userPlexId))
      .where(and(eq(communityVotes.vote, "keep"), eq(communityVotes.reviewRoundId, activeRoundId)))
      .groupBy(communityVotes.mediaItemId)
      .as("keep_tally");

    // Current user's community vote — scoped to active round
    const userCommunityVote = db
      .select({
        mediaItemId: communityVotes.mediaItemId,
        vote: communityVotes.vote,
      })
      .from(communityVotes)
      .where(
        and(
          eq(communityVotes.userPlexId, session.plexId),
          eq(communityVotes.reviewRoundId, activeRoundId)
        )
      )
      .as("user_cv");

    // Aggregate nomination type: explicit ordinal weights ensure 'trim' (more specific) wins
    // over 'delete' regardless of alphabetic collation. Matches getCandidatesForRound pattern.
    const aggregatedVote = sql<string>`
      CASE MAX(CASE ${userVotes.vote} WHEN 'trim' THEN 2 WHEN 'delete' THEN 1 ELSE 0 END)
        WHEN 2 THEN 'trim'
        WHEN 1 THEN 'delete'
        ELSE 'delete'
      END`.as("nomination_type");

    // MAX = keep the most seasons (least aggressive trim) when multiple users disagree.
    const aggregatedKeepSeasons = sql<number | null>`MAX(${userVotes.keepSeasons})`.as(
      "keep_seasons_agg"
    );

    const isNominator =
      sql<number>`MAX(CASE WHEN ${userVotes.userPlexId} = ${session.plexId} THEN 1 ELSE 0 END)`.as(
        "is_nominator"
      );

    // Resolve nominator usernames (who voted delete/trim)
    const nominatorUser = db
      .select({ plexId: users.plexId, username: users.username })
      .from(users)
      .as("nominator_user");

    const nominatedByUsernames = sql<string>`GROUP_CONCAT(DISTINCT ${nominatorUser.username})`.as(
      "nominated_by_usernames"
    );

    let baseQuery = db
      .select({
        ...baseMediaColumns,
        ...watchStatusColumns,
        requestedByUsername: users.username,
        nominationType: aggregatedVote,
        keepSeasons: aggregatedKeepSeasons,
        keepCount: keepCountSub.cnt,
        keepVoterUsernames: keepCountSub.voterUsernames,
        nominatedByUsernames,
        currentUserVote: userCommunityVote.vote,
        selfVoteUpdatedAt: sql<string>`MAX(${userVotes.updatedAt})`.as("self_vote_updated_at"),
        isNominator,
      })
      .from(mediaItems)
      .innerJoin(userVotes, baseCondition)
      .leftJoin(users, eq(users.plexId, mediaItems.requestedByPlexId))
      .leftJoin(
        watchStatus,
        and(eq(watchStatus.mediaItemId, mediaItems.id), eq(watchStatus.userPlexId, session.plexId))
      )
      .leftJoin(nominatorUser, eq(nominatorUser.plexId, userVotes.userPlexId))
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

    // Count query — separate paths to keep Drizzle types clean
    const total = await getCandidateCount(db, baseCondition, query, session.plexId, activeRoundId);

    return NextResponse.json({
      items: items.map((i) => ({
        ...mapBaseMediaFields(i),
        requestedByUsername: i.requestedByUsername || null,
        nominationType: (i.nominationType === "trim" ? "trim" : "delete") as "delete" | "trim",
        keepSeasons: i.keepSeasons ? Number(i.keepSeasons) : null,
        watchStatus: mapWatchStatus(i),
        nominatedBy: i.nominatedByUsernames ? i.nominatedByUsernames.split(",") : [],
        tally: {
          keepCount: Number(i.keepCount) || 0,
          keepVoters: i.keepVoterUsernames ? i.keepVoterUsernames.split(",") : [],
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
