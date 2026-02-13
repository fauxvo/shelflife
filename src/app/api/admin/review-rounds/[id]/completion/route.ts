import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/auth/middleware";
import { db } from "@/lib/db";
import { reviewRounds, users, userReviewStatuses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const roundId = Number(id);

    if (isNaN(roundId)) {
      return NextResponse.json({ error: "Invalid round ID" }, { status: 400 });
    }

    // Verify round exists
    const round = await db
      .select({ id: reviewRounds.id })
      .from(reviewRounds)
      .where(eq(reviewRounds.id, roundId))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!round) {
      return NextResponse.json({ error: "Review round not found" }, { status: 404 });
    }

    // All non-admin users are eligible participants
    const participants = await db
      .select({
        plexId: users.plexId,
        username: users.username,
      })
      .from(users)
      .where(eq(users.isAdmin, false));

    // Get statuses for this round
    const statuses = await db
      .select({
        userPlexId: userReviewStatuses.userPlexId,
        nominationsComplete: userReviewStatuses.nominationsComplete,
        votingComplete: userReviewStatuses.votingComplete,
        nominationsCompletedAt: userReviewStatuses.nominationsCompletedAt,
        votingCompletedAt: userReviewStatuses.votingCompletedAt,
      })
      .from(userReviewStatuses)
      .where(eq(userReviewStatuses.reviewRoundId, roundId));

    const statusMap = new Map(statuses.map((s) => [s.userPlexId, s]));

    let nominationsCompleteCount = 0;
    let votingCompleteCount = 0;

    const userList = participants.map((p) => {
      const status = statusMap.get(p.plexId);
      const nominationsComplete = status?.nominationsComplete ?? false;
      const votingComplete = status?.votingComplete ?? false;

      if (nominationsComplete) nominationsCompleteCount++;
      if (votingComplete) votingCompleteCount++;

      return {
        username: p.username,
        nominationsComplete,
        votingComplete,
        nominationsCompletedAt: status?.nominationsCompletedAt ?? null,
        votingCompletedAt: status?.votingCompletedAt ?? null,
      };
    });

    return NextResponse.json({
      totalParticipants: participants.length,
      nominationsComplete: nominationsCompleteCount,
      votingComplete: votingCompleteCount,
      users: userList,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
