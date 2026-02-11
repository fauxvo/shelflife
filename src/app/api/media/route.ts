import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import { mediaQuerySchema } from "@/lib/validators/schemas";
import {
  mediaQueryWithJoins,
  mediaCountWithJoins,
  mapMediaItemRow,
  buildPagination,
} from "@/lib/db/queries";
import { mediaItems, userVotes, watchStatus } from "@/lib/db/schema";
import { getCommonSortOrder, DEFAULT_SORT_ORDER } from "@/lib/db/sorting";
import { eq, and, ne, isNull, inArray, like, type SQL } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    const params = Object.fromEntries(request.nextUrl.searchParams);
    const query = mediaQuerySchema.parse(params);

    const offset = (query.page - 1) * query.limit;

    // Build conditions - all filtering happens in SQL
    // SECURITY: scope=all (default) intentionally shows all library items to any authenticated user.
    // Vote/watch data is still scoped to the current user via LEFT JOIN in mediaQueryWithJoins.
    // Write endpoints (POST /api/media/[id]/vote) separately enforce ownership.
    // When status=all, hide removed items so they don't clutter the default view.
    // Users can explicitly select ?status=removed to see them.
    const conditions: SQL[] = [];
    if (query.scope === "personal") {
      conditions.push(eq(mediaItems.requestedByPlexId, session.plexId));
    }
    if (query.status === "all") {
      conditions.push(ne(mediaItems.status, "removed"));
    }

    if (query.type !== "all") {
      conditions.push(eq(mediaItems.mediaType, query.type));
    }
    if (query.status !== "all") {
      conditions.push(eq(mediaItems.status, query.status));
    }
    if (query.vote !== "all") {
      if (query.vote === "none") {
        conditions.push(isNull(userVotes.vote));
      } else if (query.vote === "nominated") {
        conditions.push(inArray(userVotes.vote, ["delete", "trim"]));
      }
    }
    if (query.search) {
      const escaped = query.search.replace(/[%_\\]/g, "\\$&");
      conditions.push(like(mediaItems.title, `%${escaped}%`));
    }
    if (query.watched === "true") {
      conditions.push(eq(watchStatus.watched, true));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const orderExpr = getCommonSortOrder(query.sort) ?? DEFAULT_SORT_ORDER;

    const items = await mediaQueryWithJoins(session.plexId)
      .where(whereClause)
      .orderBy(orderExpr)
      .limit(query.limit)
      .offset(offset);

    const totalResult = await mediaCountWithJoins(session.plexId).where(whereClause);
    const total = totalResult[0]?.total || 0;

    return NextResponse.json({
      items: items.map(mapMediaItemRow),
      pagination: buildPagination(query.page, query.limit, total),
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
