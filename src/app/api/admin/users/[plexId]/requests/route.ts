import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/auth/middleware";
import {
  mediaQueryWithJoins,
  mediaCountWithJoins,
  mapMediaItemRow,
  buildPagination,
} from "@/lib/db/queries";
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

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 20)));
    const offset = (page - 1) * limit;
    const voteFilter = searchParams.get("vote");
    const watchedFilter = searchParams.get("watched");

    // Build conditions - all filtering happens in SQL
    const conditions: SQL[] = [eq(mediaItems.requestedByPlexId, plexId)];

    if (voteFilter && voteFilter !== "all") {
      if (voteFilter === "none") {
        conditions.push(isNull(userVotes.vote));
      } else if (voteFilter === "nominated") {
        conditions.push(inArray(userVotes.vote, ["delete", "trim"]));
      } else if (voteFilter === "delete" || voteFilter === "trim") {
        conditions.push(eq(userVotes.vote, voteFilter));
      }
      // Unknown vote filter values are silently ignored (treated as "all")
    }
    if (watchedFilter === "true") {
      conditions.push(eq(watchStatus.watched, true));
    }

    const whereClause = and(...conditions)!;

    const items = await mediaQueryWithJoins(plexId)
      .where(whereClause)
      .orderBy(mediaItems.title)
      .limit(limit)
      .offset(offset);

    const totalResult = await mediaCountWithJoins(plexId).where(whereClause);
    const total = totalResult[0]?.total || 0;

    // Fetch admin's own votes for these items
    const itemIds = items.map((i) => i.id);
    const adminVotes =
      itemIds.length > 0
        ? await db
            .select({
              mediaItemId: userVotes.mediaItemId,
              vote: userVotes.vote,
              keepSeasons: userVotes.keepSeasons,
            })
            .from(userVotes)
            .where(
              and(
                eq(userVotes.userPlexId, adminSession.plexId),
                inArray(userVotes.mediaItemId, itemIds)
              )
            )
        : [];
    const adminVoteMap = Object.fromEntries(adminVotes.map((v) => [v.mediaItemId, v]));

    return NextResponse.json({
      items: items.map((i) => ({
        ...mapMediaItemRow(i),
        adminVote: adminVoteMap[i.id]?.vote ?? null,
        adminKeepSeasons: adminVoteMap[i.id]?.keepSeasons ?? null,
      })),
      pagination: buildPagination(page, limit, total),
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
