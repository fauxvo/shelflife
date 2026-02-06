import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import { voteSchema } from "@/lib/validators/schemas";
import { db } from "@/lib/db";
import { mediaItems, userVotes } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const mediaItemId = Number(id);

    if (isNaN(mediaItemId)) {
      return NextResponse.json({ error: "Invalid media item ID" }, { status: 400 });
    }

    const body = await request.json();
    const { vote } = voteSchema.parse(body);

    // Verify the media item belongs to this user
    const item = await db
      .select()
      .from(mediaItems)
      .where(
        and(
          eq(mediaItems.id, mediaItemId),
          eq(mediaItems.requestedByPlexId, session.plexId)
        )
      )
      .limit(1);

    if (item.length === 0) {
      return NextResponse.json(
        { error: "Media item not found or not your request" },
        { status: 404 }
      );
    }

    // Upsert vote
    await db
      .insert(userVotes)
      .values({
        mediaItemId,
        userPlexId: session.plexId,
        vote,
      })
      .onConflictDoUpdate({
        target: [userVotes.mediaItemId, userVotes.userPlexId],
        set: {
          vote,
          updatedAt: sql`datetime('now')`,
        },
      });

    return NextResponse.json({ success: true, vote });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Invalid vote value" }, { status: 400 });
    }
    return handleAuthError(error);
  }
}
