import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import { communityVoteSchema } from "@/lib/validators/schemas";
import { db } from "@/lib/db";
import { mediaItems, userVotes, communityVotes, users } from "@/lib/db/schema";
import { eq, and, ne, inArray, or } from "drizzle-orm";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const mediaItemId = Number(id);

    if (isNaN(mediaItemId)) {
      return NextResponse.json({ error: "Invalid media item ID" }, { status: 400 });
    }

    // Body is optional — the only valid community vote is "keep"
    const vote = "keep" as const;
    try {
      const body = await request.json();
      communityVoteSchema.parse(body);
    } catch (error) {
      // Zod validation error means an invalid vote value was sent
      if (error instanceof Error && error.name === "ZodError") {
        return NextResponse.json({ error: "Invalid vote value" }, { status: 400 });
      }
      // JSON parse error (empty body) is fine — vote defaults to "keep"
    }

    // Verify the item exists and is a valid community candidate:
    // - Someone voted "delete"/"trim" AND (they are the requestor OR they are an admin)
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
          inArray(userVotes.vote, ["delete", "trim"]),
          or(
            eq(userVotes.userPlexId, mediaItems.requestedByPlexId),
            inArray(
              userVotes.userPlexId,
              db.select({ plexId: users.plexId }).from(users).where(eq(users.isAdmin, true))
            )
          )
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
