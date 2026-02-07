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
import { eq, and, isNull, like, type SQL } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    const params = Object.fromEntries(request.nextUrl.searchParams);
    const query = mediaQuerySchema.parse(params);

    const offset = (query.page - 1) * query.limit;

    // Build conditions - all filtering happens in SQL
    const conditions: SQL[] = [eq(mediaItems.requestedByPlexId, session.plexId)];

    if (query.type !== "all") {
      conditions.push(eq(mediaItems.mediaType, query.type));
    }
    if (query.status !== "all") {
      conditions.push(eq(mediaItems.status, query.status));
    }
    if (query.vote !== "all") {
      if (query.vote === "none") {
        conditions.push(isNull(userVotes.vote));
      } else {
        conditions.push(eq(userVotes.vote, query.vote));
      }
    }
    if (query.search) {
      const escaped = query.search.replace(/[%_\\]/g, "\\$&");
      conditions.push(like(mediaItems.title, `%${escaped}%`));
    }
    if (query.watched === "true") {
      conditions.push(eq(watchStatus.watched, true));
    }

    const whereClause = and(...conditions)!;

    const items = await mediaQueryWithJoins(session.plexId)
      .where(whereClause)
      .orderBy(mediaItems.title)
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
