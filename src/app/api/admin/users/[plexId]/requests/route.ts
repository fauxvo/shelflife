import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/auth/middleware";
import {
  mediaQueryWithJoins,
  mediaCountWithJoins,
  mapMediaItemRow,
  buildPagination,
  getActiveRound,
} from "@/lib/db/queries";
import { adminUserRequestsQuerySchema } from "@/lib/validators/schemas";
import { db } from "@/lib/db";
import { mediaItems, userVotes, watchStatus } from "@/lib/db/schema";
import { eq, and, inArray, isNull, type SQL } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ plexId: string }> }
) {
  try {
    const adminSession = await requireAdmin();
    const { plexId } = await params;

    const rawParams = Object.fromEntries(request.nextUrl.searchParams);
    const query = adminUserRequestsQuerySchema.parse(rawParams);
    const offset = (query.page - 1) * query.limit;

    // Get active round for vote scoping
    const activeRound = await getActiveRound();
    const roundId = activeRound?.id;

    // Build conditions - all filtering happens in SQL
    const conditions: SQL[] = [eq(mediaItems.requestedByPlexId, plexId)];

    if (query.vote !== "all") {
      if (query.vote === "none") {
        conditions.push(isNull(userVotes.vote));
      } else if (query.vote === "nominated") {
        conditions.push(inArray(userVotes.vote, ["delete", "trim"]));
      } else {
        conditions.push(eq(userVotes.vote, query.vote));
      }
    }
    if (query.watched === "true") {
      conditions.push(eq(watchStatus.watched, true));
    }

    const whereClause = and(...conditions)!;

    const items = await mediaQueryWithJoins(plexId, roundId)
      .where(whereClause)
      .orderBy(mediaItems.title)
      .limit(query.limit)
      .offset(offset);

    const totalResult = await mediaCountWithJoins(plexId, roundId).where(whereClause);
    const total = totalResult[0]?.total || 0;

    // Fetch admin's own votes for these items (scoped to active round)
    const itemIds = items.map((i) => i.id);
    const adminVoteConditions = [
      eq(userVotes.userPlexId, adminSession.plexId),
      inArray(userVotes.mediaItemId, itemIds),
    ];
    if (roundId !== undefined) {
      adminVoteConditions.push(eq(userVotes.reviewRoundId, roundId));
    }
    const adminVotes =
      itemIds.length > 0
        ? await db
            .select({
              mediaItemId: userVotes.mediaItemId,
              vote: userVotes.vote,
              keepSeasons: userVotes.keepSeasons,
            })
            .from(userVotes)
            .where(and(...adminVoteConditions))
        : [];
    const adminVoteMap = Object.fromEntries(adminVotes.map((v) => [v.mediaItemId, v]));

    return NextResponse.json({
      items: items.map((i) => ({
        ...mapMediaItemRow(i),
        adminVote: adminVoteMap[i.id]?.vote ?? null,
        adminKeepSeasons: adminVoteMap[i.id]?.keepSeasons ?? null,
      })),
      pagination: buildPagination(query.page, query.limit, total),
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
