import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import { voteSchema } from "@/lib/validators/schemas";
import { db } from "@/lib/db";
import { mediaItems, userVotes, reviewRounds } from "@/lib/db/schema";
import { eq, and, count } from "drizzle-orm";
import { MAX_NOMINATIONS_PER_ROUND } from "@/lib/constants";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const mediaItemId = Number(id);

    if (isNaN(mediaItemId)) {
      return NextResponse.json({ error: "Invalid media item ID" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = voteSchema.parse(body);
    const { vote } = parsed;
    const keepSeasons = vote === "trim" ? (parsed.keepSeasons ?? null) : null;

    // All checks + upsert in a single synchronous transaction to prevent TOCTOU
    // races (e.g., round closed between check and insert, or concurrent requests
    // both passing the rate limit count check).
    const result = db.transaction((tx) => {
      // Gate on active review round — inside transaction to prevent round
      // being closed between check and vote insert
      const rounds = tx
        .select({ id: reviewRounds.id })
        .from(reviewRounds)
        .where(eq(reviewRounds.status, "active"))
        .limit(1)
        .all();

      if (rounds.length === 0) {
        return { error: "No active review round", status: 400 } as const;
      }
      const roundId = rounds[0].id;

      // Verify the media item exists — any authenticated user can nominate any item
      // (admin review round is the governance layer, with a per-user nomination cap)
      const item = tx
        .select({
          id: mediaItems.id,
          mediaType: mediaItems.mediaType,
          seasonCount: mediaItems.seasonCount,
        })
        .from(mediaItems)
        .where(eq(mediaItems.id, mediaItemId))
        .limit(1)
        .all();

      if (item.length === 0) {
        return { error: "Media item not found", status: 404 } as const;
      }

      // Trim-specific validations
      if (vote === "trim") {
        if (item[0].mediaType !== "tv") {
          return { error: "Trim is only available for TV shows", status: 400 } as const;
        }
        if (!item[0].seasonCount || item[0].seasonCount <= 1) {
          return { error: "Trim requires a show with more than one season", status: 400 } as const;
        }
        if (keepSeasons != null && keepSeasons >= item[0].seasonCount) {
          return {
            error: "keepSeasons must be less than the total season count",
            status: 400,
          } as const;
        }
      }

      // Rate limit for non-admins
      if (!session.isAdmin) {
        // Count nominations in the current round only (round-scoped via FK)
        const [existing] = tx
          .select({ total: count() })
          .from(userVotes)
          .where(
            and(eq(userVotes.userPlexId, session.plexId), eq(userVotes.reviewRoundId, roundId))
          )
          .all();

        // Allow re-voting on already-nominated items (existing vote doesn't count toward cap)
        const existingVote = tx
          .select({ id: userVotes.id })
          .from(userVotes)
          .where(
            and(
              eq(userVotes.mediaItemId, mediaItemId),
              eq(userVotes.userPlexId, session.plexId),
              eq(userVotes.reviewRoundId, roundId)
            )
          )
          .limit(1)
          .all();

        if (existing.total >= MAX_NOMINATIONS_PER_ROUND && existingVote.length === 0) {
          return {
            error: `You can nominate up to ${MAX_NOMINATIONS_PER_ROUND} items per review round`,
            status: 429,
          } as const;
        }
      }

      tx.insert(userVotes)
        .values({
          mediaItemId,
          userPlexId: session.plexId,
          reviewRoundId: roundId,
          vote,
          keepSeasons,
        })
        .onConflictDoUpdate({
          target: [userVotes.mediaItemId, userVotes.userPlexId, userVotes.reviewRoundId],
          set: {
            vote,
            keepSeasons,
            updatedAt: new Date().toISOString(),
          },
        })
        .run();

      return { success: true } as const;
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, vote, keepSeasons });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid vote value" }, { status: 400 });
    }
    return handleAuthError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const mediaItemId = Number(id);

    if (isNaN(mediaItemId)) {
      return NextResponse.json({ error: "Invalid media item ID" }, { status: 400 });
    }

    const result = db.transaction((tx) => {
      const rounds = tx
        .select({ id: reviewRounds.id })
        .from(reviewRounds)
        .where(eq(reviewRounds.status, "active"))
        .limit(1)
        .all();

      if (rounds.length === 0) {
        return { error: "No active review round", status: 400 } as const;
      }

      const item = tx
        .select({ id: mediaItems.id })
        .from(mediaItems)
        .where(eq(mediaItems.id, mediaItemId))
        .limit(1)
        .all();

      if (item.length === 0) {
        return { error: "Media item not found", status: 404 } as const;
      }

      const deleted = tx
        .delete(userVotes)
        .where(
          and(
            eq(userVotes.mediaItemId, mediaItemId),
            eq(userVotes.userPlexId, session.plexId),
            eq(userVotes.reviewRoundId, rounds[0].id)
          )
        )
        .returning({ id: userVotes.id })
        .all();

      return { success: true, deleted: deleted.length > 0 } as const;
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, deleted: result.deleted });
  } catch (error) {
    return handleAuthError(error);
  }
}
