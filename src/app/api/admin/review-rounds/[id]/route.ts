import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/auth/middleware";
import { db } from "@/lib/db";
import {
  reviewRounds,
  reviewActions,
  mediaItems,
  userVotes,
  communityVotes,
  users,
} from "@/lib/db/schema";
import { eq, and, count, sql, inArray } from "drizzle-orm";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const roundId = Number(id);

    if (isNaN(roundId)) {
      return NextResponse.json({ error: "Invalid round ID" }, { status: 400 });
    }

    const round = await db.select().from(reviewRounds).where(eq(reviewRounds.id, roundId)).limit(1);

    if (round.length === 0) {
      return NextResponse.json({ error: "Review round not found" }, { status: 404 });
    }

    // Tally subqueries — separate counts avoid raw SQL SUM(CASE WHEN)
    const keepCountSub = db
      .select({
        mediaItemId: communityVotes.mediaItemId,
        cnt: count().as("keep_count"),
      })
      .from(communityVotes)
      .where(eq(communityVotes.vote, "keep"))
      .groupBy(communityVotes.mediaItemId)
      .as("keep_tally");

    const removeCountSub = db
      .select({
        mediaItemId: communityVotes.mediaItemId,
        cnt: count().as("remove_count"),
      })
      .from(communityVotes)
      .where(eq(communityVotes.vote, "remove"))
      .groupBy(communityVotes.mediaItemId)
      .as("remove_tally");

    const actionSubquery = db
      .select({
        mediaItemId: reviewActions.mediaItemId,
        action: reviewActions.action,
      })
      .from(reviewActions)
      .where(eq(reviewActions.reviewRoundId, roundId))
      .as("round_action");

    const candidates = await db
      .select({
        id: mediaItems.id,
        title: mediaItems.title,
        mediaType: mediaItems.mediaType,
        status: mediaItems.status,
        requestedByUsername: users.username,
        seasonCount: mediaItems.seasonCount,
        nominationType: userVotes.vote,
        keepSeasons: userVotes.keepSeasons,
        keepCount: keepCountSub.cnt,
        removeCount: removeCountSub.cnt,
        action: actionSubquery.action,
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
      .leftJoin(users, eq(users.plexId, mediaItems.requestedByPlexId))
      .leftJoin(keepCountSub, eq(keepCountSub.mediaItemId, mediaItems.id))
      .leftJoin(removeCountSub, eq(removeCountSub.mediaItemId, mediaItems.id))
      .leftJoin(actionSubquery, eq(actionSubquery.mediaItemId, mediaItems.id))
      .orderBy(sql`(COALESCE(${removeCountSub.cnt}, 0) - COALESCE(${keepCountSub.cnt}, 0)) DESC`);

    return NextResponse.json({
      round: round[0],
      candidates: candidates.map((c) => ({
        id: c.id,
        title: c.title,
        mediaType: c.mediaType,
        status: c.status,
        requestedByUsername: c.requestedByUsername || "Unknown",
        seasonCount: c.seasonCount || null,
        nominationType: (c.nominationType === "trim" ? "trim" : "delete") as "delete" | "trim",
        keepSeasons: c.keepSeasons || null,
        tally: {
          keepCount: Number(c.keepCount) || 0,
          removeCount: Number(c.removeCount) || 0,
        },
        action: c.action || null,
      })),
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
