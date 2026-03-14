import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/auth/middleware";
import { db } from "@/lib/db";
import { reviewRounds, reviewActions, communityVotes, userVotes } from "@/lib/db/schema";
import { eq, and, notInArray } from "drizzle-orm";
import { debug } from "@/lib/debug";

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

      // Community votes are round-scoped — delete only this round's votes.
      const deletedVotes = tx
        .delete(communityVotes)
        .where(eq(communityVotes.reviewRoundId, roundId))
        .returning({ id: communityVotes.id })
        .all();
      debug.sync(
        `[review-round] Cleared ${deletedVotes.length} community votes on round close ${roundId}`
      );

      // Nominations are round-scoped via FK — delete this round's nominations.
      // Items marked "remove" keep their nominations for historical reference.
      // Non-actioned items must be re-nominated in the next round.
      if (removedItemIds.length > 0) {
        tx.delete(userVotes)
          .where(
            and(
              eq(userVotes.reviewRoundId, roundId),
              notInArray(userVotes.mediaItemId, removedItemIds)
            )
          )
          .run();
      } else {
        tx.delete(userVotes).where(eq(userVotes.reviewRoundId, roundId)).run();
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
