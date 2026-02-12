import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAdmin, handleAuthError } from "@/lib/auth/middleware";
import { reviewActionSchema } from "@/lib/validators/schemas";
import { db } from "@/lib/db";
import { reviewRounds, reviewActions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const roundId = Number(id);

    if (isNaN(roundId)) {
      return NextResponse.json({ error: "Invalid round ID" }, { status: 400 });
    }

    const body = await request.json();
    const { mediaItemId, action } = reviewActionSchema.parse(body);

    // Verify round exists and is active
    const round = await db
      .select()
      .from(reviewRounds)
      .where(and(eq(reviewRounds.id, roundId), eq(reviewRounds.status, "active")))
      .limit(1);

    if (round.length === 0) {
      return NextResponse.json({ error: "Review round not found or not active" }, { status: 404 });
    }

    // Upsert action using unique index on (review_round_id, media_item_id)
    await db
      .insert(reviewActions)
      .values({
        reviewRoundId: roundId,
        mediaItemId,
        action,
        actedByPlexId: session.plexId,
      })
      .onConflictDoUpdate({
        target: [reviewActions.reviewRoundId, reviewActions.mediaItemId],
        set: {
          action,
          actedAt: new Date().toISOString(),
          actedByPlexId: session.plexId,
        },
      });

    return NextResponse.json({ success: true, action });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid action data" }, { status: 400 });
    }
    return handleAuthError(error);
  }
}
