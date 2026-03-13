import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import { communityVoteSchema } from "@/lib/validators/schemas";
import { db } from "@/lib/db";
import { mediaItems, userVotes, communityVotes } from "@/lib/db/schema";
import { getActiveRound } from "@/lib/db/queries";
import { eq, and, inArray } from "drizzle-orm";

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
      if (error instanceof ZodError) {
        return NextResponse.json({ error: "Invalid vote value" }, { status: 400 });
      }
      // JSON parse error (empty body) is fine — vote defaults to "keep"
    }

    // Gate on active review round
    const activeRound = await getActiveRound();

    if (!activeRound) {
      return NextResponse.json({ error: "No active review round" }, { status: 400 });
    }

    // Verify the item exists and has at least one nomination
    const item = await db
      .select({
        id: mediaItems.id,
      })
      .from(mediaItems)
      .innerJoin(
        userVotes,
        and(eq(userVotes.mediaItemId, mediaItems.id), inArray(userVotes.vote, ["delete", "trim"]))
      )
      .where(eq(mediaItems.id, mediaItemId))
      .limit(1);

    if (item.length === 0) {
      return NextResponse.json({ error: "Item not found or not nominated" }, { status: 404 });
    }

    // Can't community-vote on an item you nominated yourself
    const ownNomination = await db
      .select({ id: userVotes.id })
      .from(userVotes)
      .where(
        and(
          eq(userVotes.mediaItemId, mediaItemId),
          eq(userVotes.userPlexId, session.plexId),
          inArray(userVotes.vote, ["delete", "trim"])
        )
      )
      .limit(1);

    if (ownNomination.length > 0) {
      return NextResponse.json(
        { error: "Cannot community-vote on your own nomination" },
        { status: 403 }
      );
    }

    // Upsert community vote scoped to the active round
    await db
      .insert(communityVotes)
      .values({
        mediaItemId,
        userPlexId: session.plexId,
        reviewRoundId: activeRound.id,
        vote,
      })
      .onConflictDoUpdate({
        target: [
          communityVotes.mediaItemId,
          communityVotes.userPlexId,
          communityVotes.reviewRoundId,
        ],
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

    // Gate on active review round
    const activeRound = await getActiveRound();

    if (!activeRound) {
      return NextResponse.json({ error: "No active review round" }, { status: 400 });
    }

    await db
      .delete(communityVotes)
      .where(
        and(
          eq(communityVotes.mediaItemId, mediaItemId),
          eq(communityVotes.userPlexId, session.plexId),
          eq(communityVotes.reviewRoundId, activeRound.id)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
