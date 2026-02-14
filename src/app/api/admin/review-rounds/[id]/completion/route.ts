import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/auth/middleware";
import { db } from "@/lib/db";
import { reviewRounds, users, userReviewStatuses } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

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

    // All non-admin users with their completion status in a single query
    const rows = await db
      .select({
        username: users.username,
        nominationsComplete: userReviewStatuses.nominationsComplete,
        votingComplete: userReviewStatuses.votingComplete,
        nominationsCompletedAt: userReviewStatuses.nominationsCompletedAt,
        votingCompletedAt: userReviewStatuses.votingCompletedAt,
      })
      .from(users)
      .leftJoin(
        userReviewStatuses,
        and(
          eq(userReviewStatuses.userPlexId, users.plexId),
          eq(userReviewStatuses.reviewRoundId, roundId)
        )
      )
      .where(eq(users.isAdmin, false));

    let nominationsCompleteCount = 0;
    let votingCompleteCount = 0;

    const userList = rows.map((r) => {
      const nominationsComplete = r.nominationsComplete ?? false;
      const votingComplete = r.votingComplete ?? false;

      if (nominationsComplete) nominationsCompleteCount++;
      if (votingComplete) votingCompleteCount++;

      return {
        username: r.username,
        nominationsComplete,
        votingComplete,
        nominationsCompletedAt: r.nominationsCompletedAt ?? null,
        votingCompletedAt: r.votingCompletedAt ?? null,
      };
    });

    return NextResponse.json({
      totalParticipants: rows.length,
      nominationsComplete: nominationsCompleteCount,
      votingComplete: votingCompleteCount,
      users: userList,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
