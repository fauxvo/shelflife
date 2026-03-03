import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/auth/middleware";
import { db } from "@/lib/db";
import { reviewRounds, reviewActions, communityVotes, userVotes } from "@/lib/db/schema";
import { eq, and, notInArray } from "drizzle-orm";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const roundId = Number(id);

    if (isNaN(roundId)) {
      return NextResponse.json({ error: "Invalid round ID" }, { status: 400 });
    }

    const round = await db
      .select()
      .from(reviewRounds)
      .where(and(eq(reviewRounds.id, roundId), eq(reviewRounds.status, "active")))
      .limit(1);

    if (round.length === 0) {
      return NextResponse.json(
        { error: "Review round not found or already closed" },
        { status: 404 }
      );
    }

    // SQLite with better-sqlite3 is single-connection synchronous — sequential
    // operations within one request handler are inherently atomic (no interleaving).
    await db
      .update(reviewRounds)
      .set({
        status: "closed",
        closedAt: new Date().toISOString(),
      })
      .where(eq(reviewRounds.id, roundId));

    // Get IDs of items that were marked "remove" in this round
    const removedItemActions = await db
      .select({ mediaItemId: reviewActions.mediaItemId })
      .from(reviewActions)
      .where(and(eq(reviewActions.reviewRoundId, roundId), eq(reviewActions.action, "remove")));
    const removedItemIds = removedItemActions.map((a) => a.mediaItemId);

    // Clear ALL community votes (keep votes are round-scoped)
    await db.delete(communityVotes);

    // Clear nominations for surviving items only
    // Items marked "remove" keep their nominations for historical reference
    if (removedItemIds.length > 0) {
      await db.delete(userVotes).where(notInArray(userVotes.mediaItemId, removedItemIds));
    } else {
      await db.delete(userVotes);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
