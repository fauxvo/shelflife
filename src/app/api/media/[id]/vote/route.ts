import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import { voteSchema } from "@/lib/validators/schemas";
import { db } from "@/lib/db";
import { mediaItems, userVotes } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const mediaItemId = Number(id);

    if (isNaN(mediaItemId)) {
      return NextResponse.json({ error: "Invalid media item ID" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = voteSchema.parse(body);
    const { vote } = parsed;
    const keepSeasons = vote === "trim" ? (parsed.keepSeasons ?? null) : null;

    // Verify the media item exists (admins can vote on any item; non-admins only their own)
    const itemConditions = [eq(mediaItems.id, mediaItemId)];
    if (!session.isAdmin) {
      itemConditions.push(eq(mediaItems.requestedByPlexId, session.plexId));
    }
    const item = await db
      .select()
      .from(mediaItems)
      .where(and(...itemConditions))
      .limit(1);

    if (item.length === 0) {
      return NextResponse.json({ error: "Media item not found" }, { status: 404 });
    }

    // Trim-specific validations
    if (vote === "trim") {
      if (item[0].mediaType !== "tv") {
        return NextResponse.json({ error: "Trim is only available for TV shows" }, { status: 400 });
      }
      if (!item[0].seasonCount || item[0].seasonCount <= 1) {
        return NextResponse.json(
          { error: "Trim requires a show with more than one season" },
          { status: 400 }
        );
      }
      if (keepSeasons! >= item[0].seasonCount) {
        return NextResponse.json(
          { error: "keepSeasons must be less than the total season count" },
          { status: 400 }
        );
      }
    }

    // Upsert vote
    await db
      .insert(userVotes)
      .values({
        mediaItemId,
        userPlexId: session.plexId,
        vote,
        keepSeasons,
      })
      .onConflictDoUpdate({
        target: [userVotes.mediaItemId, userVotes.userPlexId],
        set: {
          vote,
          keepSeasons,
          updatedAt: new Date().toISOString(),
        },
      });

    return NextResponse.json({ success: true, vote, keepSeasons });
  } catch (error) {
    if (error instanceof ZodError) {
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

    // Verify the media item exists and user has permission (admins can un-nominate any; non-admins only their own)
    const itemConditions = [eq(mediaItems.id, mediaItemId)];
    if (!session.isAdmin) {
      itemConditions.push(eq(mediaItems.requestedByPlexId, session.plexId));
    }
    const item = await db
      .select()
      .from(mediaItems)
      .where(and(...itemConditions))
      .limit(1);

    if (item.length === 0) {
      return NextResponse.json({ error: "Media item not found" }, { status: 404 });
    }

    const result = await db
      .delete(userVotes)
      .where(and(eq(userVotes.mediaItemId, mediaItemId), eq(userVotes.userPlexId, session.plexId)))
      .returning({ id: userVotes.id });

    return NextResponse.json({ success: true, deleted: result.length > 0 });
  } catch (error) {
    return handleAuthError(error);
  }
}
