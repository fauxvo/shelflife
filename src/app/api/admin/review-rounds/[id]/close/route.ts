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

    // All reads and mutations in a single synchronous transaction for crash
    // safety and to prevent TOCTOU races (another request closing the same round
    // between the check and the mutations).
    const notFound = db.transaction((tx) => {
      const round = tx
        .select({ id: reviewRounds.id })
        .from(reviewRounds)
        .where(and(eq(reviewRounds.id, roundId), eq(reviewRounds.status, "active")))
        .limit(1)
        .all();

      if (round.length === 0) return true;

      tx.update(reviewRounds)
        .set({
          status: "closed",
          closedAt: new Date().toISOString(),
        })
        .where(eq(reviewRounds.id, roundId))
        .run();

      // Get IDs of items that were marked "remove" in this round
      const removedItemActions = tx
        .select({ mediaItemId: reviewActions.mediaItemId })
        .from(reviewActions)
        .where(and(eq(reviewActions.reviewRoundId, roundId), eq(reviewActions.action, "remove")))
        .all();
      const removedItemIds = removedItemActions.map((a) => a.mediaItemId);

      // Community "keep" votes are round-scoped — they only exist to influence
      // the current round's admin review. Safe to clear all rows because only one
      // round can be active at a time (POST /review-rounds enforces this).
      tx.delete(communityVotes).run();

      // Clear nominations for surviving items only.
      // Items marked "remove" keep their nominations for historical reference
      // (and so their votes don't count against the user's cap in future rounds).
      if (removedItemIds.length > 0) {
        tx.delete(userVotes).where(notInArray(userVotes.mediaItemId, removedItemIds)).run();
      } else {
        tx.delete(userVotes).run();
      }

      return false;
    });

    if (notFound) {
      return NextResponse.json(
        { error: "Review round not found or already closed" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
