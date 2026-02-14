import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/auth/middleware";
import { db } from "@/lib/db";
import { reviewRounds, reviewActions, mediaItems } from "@/lib/db/schema";
import { deletionRequestSchema } from "@/lib/validators/schemas";
import { executeMediaDeletion } from "@/lib/services/deletion";
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
    const parsed = deletionRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Validate: round exists and is active
    const round = await db.select().from(reviewRounds).where(eq(reviewRounds.id, roundId)).limit(1);

    if (round.length === 0) {
      return NextResponse.json({ error: "Review round not found" }, { status: 404 });
    }

    if (round[0].status !== "active") {
      return NextResponse.json({ error: "Review round is not active" }, { status: 400 });
    }

    // Validate: there's a review action for this round+mediaItem with action "remove"
    const action = await db
      .select()
      .from(reviewActions)
      .where(
        and(
          eq(reviewActions.reviewRoundId, roundId),
          eq(reviewActions.mediaItemId, parsed.data.mediaItemId),
          eq(reviewActions.action, "remove")
        )
      )
      .limit(1);

    if (action.length === 0) {
      return NextResponse.json(
        { error: "No remove action found for this media item in this round" },
        { status: 400 }
      );
    }

    // Validate: the media item is not already removed
    const mediaItem = await db
      .select()
      .from(mediaItems)
      .where(eq(mediaItems.id, parsed.data.mediaItemId))
      .limit(1);

    if (mediaItem.length === 0) {
      return NextResponse.json({ error: "Media item not found" }, { status: 404 });
    }

    if (mediaItem[0].status === "removed") {
      return NextResponse.json({ error: "Media item has already been removed" }, { status: 400 });
    }

    const result = await executeMediaDeletion({
      mediaItemId: parsed.data.mediaItemId,
      deleteFiles: parsed.data.deleteFiles,
      deletedByPlexId: session.plexId,
      reviewRoundId: roundId,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleAuthError(error);
  }
}
