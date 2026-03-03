import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import { voteSchema } from "@/lib/validators/schemas";
import { db } from "@/lib/db";
import { mediaItems, userVotes, reviewRounds, reviewActions } from "@/lib/db/schema";
import { eq, and, count, notInArray } from "drizzle-orm";

const MAX_NOMINATIONS_PER_ROUND = 100;

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

    // Gate on active review round
    const activeRound = await db
      .select({ id: reviewRounds.id })
      .from(reviewRounds)
      .where(eq(reviewRounds.status, "active"))
      .limit(1);

    if (activeRound.length === 0) {
      return NextResponse.json({ error: "No active review round" }, { status: 400 });
    }

    // Rate limit: cap nominations per user per active round.
    // Votes on items actioned in prior rounds (kept in userVotes for historical
    // reference) are excluded so they don't count against the current round's cap.
    if (!session.isAdmin) {
      // Subquery: item IDs that already have a review action (from prior rounds)
      const actionedItems = db
        .select({ mediaItemId: reviewActions.mediaItemId })
        .from(reviewActions);

      const [existing] = await db
        .select({ total: count() })
        .from(userVotes)
        .where(
          and(
            eq(userVotes.userPlexId, session.plexId),
            notInArray(userVotes.mediaItemId, actionedItems)
          )
        );

      // Allow re-voting on already-nominated items (existing vote doesn't count toward cap)
      const existingVote = await db
        .select({ id: userVotes.id })
        .from(userVotes)
        .where(
          and(eq(userVotes.mediaItemId, mediaItemId), eq(userVotes.userPlexId, session.plexId))
        )
        .limit(1);

      if (existing.total >= MAX_NOMINATIONS_PER_ROUND && existingVote.length === 0) {
        return NextResponse.json(
          { error: `You can nominate up to ${MAX_NOMINATIONS_PER_ROUND} items per review round` },
          { status: 429 }
        );
      }
    }

    // Verify the media item exists — any authenticated user can nominate any item
    // (admin review round is the governance layer, with a per-user nomination cap)
    const item = await db.select().from(mediaItems).where(eq(mediaItems.id, mediaItemId)).limit(1);

    if (item.length === 0) {
      return NextResponse.json({ error: "Media item not found" }, { status: 404 });
    }

    // Trim-specific validations
    if (vote === "trim") {
      if (item[0].mediaType !== "tv") {
        return NextResponse.json({ error: "Trim is only available for TV shows" }, { status: 400 });
      }
      if (!item[0].seasonCount || item[0].seasonCount <= 1) {
        return NextResponse.json(
          { error: "Trim requires a show with more than one season" },
          { status: 400 }
        );
      }
      if (keepSeasons != null && keepSeasons >= item[0].seasonCount) {
        return NextResponse.json(
          { error: "keepSeasons must be less than the total season count" },
          { status: 400 }
        );
      }
    }

    // Upsert vote
    await db
      .insert(userVotes)
      .values({
        mediaItemId,
        userPlexId: session.plexId,
        vote,
        keepSeasons,
      })
      .onConflictDoUpdate({
        target: [userVotes.mediaItemId, userVotes.userPlexId],
        set: {
          vote,
          keepSeasons,
          updatedAt: new Date().toISOString(),
        },
      });

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

    // Any user can un-nominate their own vote.
    // Admins manage nominations via review rounds, not direct vote deletion.
    const item = await db.select().from(mediaItems).where(eq(mediaItems.id, mediaItemId)).limit(1);

    if (item.length === 0) {
      return NextResponse.json({ error: "Media item not found" }, { status: 404 });
    }

    const result = await db
      .delete(userVotes)
      .where(and(eq(userVotes.mediaItemId, mediaItemId), eq(userVotes.userPlexId, session.plexId)))
      .returning({ id: userVotes.id });

    return NextResponse.json({ success: true, deleted: result.length > 0 });
  } catch (error) {
    return handleAuthError(error);
  }
}
