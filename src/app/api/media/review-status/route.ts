import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import { reviewStatusToggleSchema } from "@/lib/validators/schemas";
import { db } from "@/lib/db";
import { reviewRounds, userReviewStatuses } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

function getActiveRound() {
  return db
    .select({
      id: reviewRounds.id,
      name: reviewRounds.name,
      endDate: reviewRounds.endDate,
    })
    .from(reviewRounds)
    .where(eq(reviewRounds.status, "active"))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

export async function GET() {
  try {
    const session = await requireAuth();

    const activeRound = await getActiveRound();
    if (!activeRound) {
      return NextResponse.json({ activeRound: null, status: null });
    }

    const row = await db
      .select({
        nominationsComplete: userReviewStatuses.nominationsComplete,
        votingComplete: userReviewStatuses.votingComplete,
      })
      .from(userReviewStatuses)
      .where(
        and(
          eq(userReviewStatuses.reviewRoundId, activeRound.id),
          eq(userReviewStatuses.userPlexId, session.plexId)
        )
      )
      .limit(1)
      .then((rows) => rows[0] ?? null);

    return NextResponse.json({
      activeRound,
      status: row ?? { nominationsComplete: false, votingComplete: false },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { field, value } = reviewStatusToggleSchema.parse(body);

    const activeRound = await getActiveRound();
    if (!activeRound) {
      return NextResponse.json({ error: "No active review round" }, { status: 404 });
    }

    const now = new Date().toISOString();
    const isNominations = field === "nominations_complete";
    const timestampValue = value ? now : null;

    // Fetch existing row so we preserve the other field's state on insert
    const existing = await db
      .select()
      .from(userReviewStatuses)
      .where(
        and(
          eq(userReviewStatuses.reviewRoundId, activeRound.id),
          eq(userReviewStatuses.userPlexId, session.plexId)
        )
      )
      .limit(1)
      .then((rows) => rows[0] ?? null);

    await db
      .insert(userReviewStatuses)
      .values({
        reviewRoundId: activeRound.id,
        userPlexId: session.plexId,
        nominationsComplete: isNominations ? value : (existing?.nominationsComplete ?? false),
        votingComplete: isNominations ? (existing?.votingComplete ?? false) : value,
        nominationsCompletedAt: isNominations
          ? timestampValue
          : (existing?.nominationsCompletedAt ?? null),
        votingCompletedAt: isNominations ? (existing?.votingCompletedAt ?? null) : timestampValue,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [userReviewStatuses.reviewRoundId, userReviewStatuses.userPlexId],
        set: {
          ...(isNominations
            ? { nominationsComplete: value, nominationsCompletedAt: timestampValue }
            : { votingComplete: value, votingCompletedAt: timestampValue }),
          updatedAt: now,
        },
      });

    return NextResponse.json({ success: true, field, value });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    return handleAuthError(error);
  }
}
