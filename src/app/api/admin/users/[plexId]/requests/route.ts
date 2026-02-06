import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/auth/middleware";
import { mediaQueryWithJoins, mediaCountWithJoins, mapMediaItemRow, buildPagination } from "@/lib/db/queries";
import { mediaItems, userVotes, watchStatus } from "@/lib/db/schema";
import { eq, and, isNull, type SQL } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ plexId: string }> }
) {
  try {
    await requireAdmin();
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
      } else {
        conditions.push(eq(userVotes.vote, voteFilter as "keep" | "delete"));
      }
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

    return NextResponse.json({
      items: items.map(mapMediaItemRow),
      pagination: buildPagination(page, limit, total),
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
