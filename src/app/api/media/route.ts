import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import { mediaQuerySchema } from "@/lib/validators/schemas";
import { db } from "@/lib/db";
import { mediaItems, userVotes, watchStatus } from "@/lib/db/schema";
import { eq, and, sql, count } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    const params = Object.fromEntries(request.nextUrl.searchParams);
    const query = mediaQuerySchema.parse(params);

    const offset = (query.page - 1) * query.limit;

    // Build conditions
    const conditions = [eq(mediaItems.requestedByPlexId, session.plexId)];

    if (query.type !== "all") {
      conditions.push(eq(mediaItems.mediaType, query.type));
    }
    if (query.status !== "all") {
      conditions.push(eq(mediaItems.status, query.status));
    }

    // Get items with votes and watch status
    const items = await db
      .select({
        id: mediaItems.id,
        overseerrId: mediaItems.overseerrId,
        tmdbId: mediaItems.tmdbId,
        mediaType: mediaItems.mediaType,
        title: mediaItems.title,
        posterPath: mediaItems.posterPath,
        status: mediaItems.status,
        requestedAt: mediaItems.requestedAt,
        ratingKey: mediaItems.ratingKey,
        vote: userVotes.vote,
        watched: watchStatus.watched,
        playCount: watchStatus.playCount,
        lastWatchedAt: watchStatus.lastWatchedAt,
      })
      .from(mediaItems)
      .leftJoin(
        userVotes,
        and(
          eq(userVotes.mediaItemId, mediaItems.id),
          eq(userVotes.userPlexId, session.plexId)
        )
      )
      .leftJoin(
        watchStatus,
        and(
          eq(watchStatus.mediaItemId, mediaItems.id),
          eq(watchStatus.userPlexId, session.plexId)
        )
      )
      .where(and(...conditions))
      .orderBy(mediaItems.title)
      .limit(query.limit)
      .offset(offset);

    // Get total count
    const totalResult = await db
      .select({ total: count() })
      .from(mediaItems)
      .where(and(...conditions));

    const total = totalResult[0]?.total || 0;

    // Filter by vote if needed (post-query since it's a left join)
    let filtered = items;
    if (query.vote !== "all") {
      if (query.vote === "none") {
        filtered = items.filter((i) => !i.vote);
      } else {
        filtered = items.filter((i) => i.vote === query.vote);
      }
    }

    return NextResponse.json({
      items: filtered.map((i) => ({
        id: i.id,
        overseerrId: i.overseerrId,
        tmdbId: i.tmdbId,
        mediaType: i.mediaType,
        title: i.title,
        posterPath: i.posterPath,
        status: i.status,
        requestedAt: i.requestedAt,
        ratingKey: i.ratingKey,
        vote: i.vote || null,
        watchStatus: i.watched !== null
          ? {
              watched: i.watched,
              playCount: i.playCount || 0,
              lastWatchedAt: i.lastWatchedAt,
            }
          : null,
      })),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit),
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
