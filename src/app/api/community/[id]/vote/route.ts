import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import { communityVoteSchema } from "@/lib/validators/schemas";
import { db } from "@/lib/db";
import { mediaItems, userVotes, communityVotes } from "@/lib/db/schema";
import { eq, and, ne, inArray } from "drizzle-orm";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const mediaItemId = Number(id);

    if (isNaN(mediaItemId)) {
      return NextResponse.json({ error: "Invalid media item ID" }, { status: 400 });
    }

    const body = await request.json();
    const { vote } = communityVoteSchema.parse(body);

    // Verify the item exists and is a valid community candidate:
    // - The requestor must have voted "delete" on their own item
    // - The current user is NOT the requestor (can't community-vote on your own)
    const item = await db
      .select({
        id: mediaItems.id,
        requestedByPlexId: mediaItems.requestedByPlexId,
      })
      .from(mediaItems)
      .innerJoin(
        userVotes,
        and(
          eq(userVotes.mediaItemId, mediaItems.id),
          eq(userVotes.userPlexId, mediaItems.requestedByPlexId),
          inArray(userVotes.vote, ["delete", "trim"])
        )
      )
      .where(and(eq(mediaItems.id, mediaItemId), ne(mediaItems.requestedByPlexId, session.plexId)))
      .limit(1);

    if (item.length === 0) {
      return NextResponse.json(
        { error: "Item not found, not nominated, or is your own request" },
        { status: 404 }
      );
    }

    // Upsert community vote
    await db
      .insert(communityVotes)
      .values({
        mediaItemId,
        userPlexId: session.plexId,
        vote,
      })
      .onConflictDoUpdate({
        target: [communityVotes.mediaItemId, communityVotes.userPlexId],
        set: {
          vote,
          updatedAt: new Date().toISOString(),
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

    await db
      .delete(communityVotes)
      .where(
        and(
          eq(communityVotes.mediaItemId, mediaItemId),
          eq(communityVotes.userPlexId, session.plexId)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
