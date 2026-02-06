import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/auth/middleware";
import { adminCandidatesQuerySchema } from "@/lib/validators/schemas";
import { buildPagination } from "@/lib/db/queries";
import { db } from "@/lib/db";
import { mediaItems, userVotes, watchStatus, users } from "@/lib/db/schema";
import { eq, and, count } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const params = Object.fromEntries(request.nextUrl.searchParams);
    const query = adminCandidatesQuerySchema.parse(params);

    const offset = (query.page - 1) * query.limit;

    // Get all items where the requestor voted "delete"
    const candidates = await db
      .select({
        id: mediaItems.id,
        overseerrId: mediaItems.overseerrId,
        tmdbId: mediaItems.tmdbId,
        mediaType: mediaItems.mediaType,
        title: mediaItems.title,
        posterPath: mediaItems.posterPath,
        status: mediaItems.status,
        requestedAt: mediaItems.requestedAt,
        requestedByPlexId: mediaItems.requestedByPlexId,
        requestedByUsername: users.username,
        vote: userVotes.vote,
        watched: watchStatus.watched,
        playCount: watchStatus.playCount,
      })
      .from(mediaItems)
      .innerJoin(
        userVotes,
        and(
          eq(userVotes.mediaItemId, mediaItems.id),
          eq(userVotes.userPlexId, mediaItems.requestedByPlexId),
          eq(userVotes.vote, "delete")
        )
      )
      .leftJoin(users, eq(users.plexId, mediaItems.requestedByPlexId))
      .leftJoin(
        watchStatus,
        and(
          eq(watchStatus.mediaItemId, mediaItems.id),
          eq(watchStatus.userPlexId, mediaItems.requestedByPlexId)
        )
      )
      .orderBy(mediaItems.title)
      .limit(query.limit)
      .offset(offset);

    // Total count
    const totalResult = await db
      .select({ total: count() })
      .from(mediaItems)
      .innerJoin(
        userVotes,
        and(
          eq(userVotes.mediaItemId, mediaItems.id),
          eq(userVotes.userPlexId, mediaItems.requestedByPlexId),
          eq(userVotes.vote, "delete")
        )
      );

    const total = totalResult[0]?.total || 0;

    return NextResponse.json({
      candidates: candidates.map((c) => ({
        id: c.id,
        overseerrId: c.overseerrId,
        tmdbId: c.tmdbId,
        mediaType: c.mediaType,
        title: c.title,
        posterPath: c.posterPath,
        status: c.status,
        requestedAt: c.requestedAt,
        requestedByUsername: c.requestedByUsername || "Unknown",
        vote: c.vote,
        watched: c.watched ?? false,
        playCount: c.playCount ?? 0,
      })),
      pagination: buildPagination(query.page, query.limit, total),
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
