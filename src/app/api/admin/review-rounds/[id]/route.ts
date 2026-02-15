import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/auth/middleware";
import { db } from "@/lib/db";
import { getCandidatesForRound } from "@/lib/db/queries";
import { reviewRounds } from "@/lib/db/schema";
import { reviewRoundUpdateSchema } from "@/lib/validators/schemas";
import { eq } from "drizzle-orm";

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

    const candidates = await getCandidatesForRound(roundId);

    return NextResponse.json({
      round: round[0],
      candidates: candidates.map((c) => ({
        id: c.id,
        title: c.title,
        mediaType: c.mediaType,
        status: c.status,
        posterPath: c.posterPath || null,
        tmdbId: c.tmdbId ?? null,
        tvdbId: c.tvdbId ?? null,
        overseerrId: c.overseerrId ?? null,
        imdbId: c.imdbId ?? null,
        requestedByUsername: c.requestedByUsername || "Unknown",
        nominatedBy: c.nominatedByUsernames ? c.nominatedByUsernames.split(",") : [],
        seasonCount: c.seasonCount || null,
        availableSeasonCount: c.availableSeasonCount || null,
        nominationType: (c.nominationType === "trim" ? "trim" : "delete") as "delete" | "trim",
        keepSeasons: c.keepSeasons ? Number(c.keepSeasons) : null,
        tally: {
          keepCount: c.keepCount ?? 0,
          keepVoters: c.keepVoterUsernames ? c.keepVoterUsernames.split(",") : [],
        },
        action: c.action || null,
      })),
    });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const roundId = Number(id);

    if (isNaN(roundId)) {
      return NextResponse.json({ error: "Invalid round ID" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = reviewRoundUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await db
      .select()
      .from(reviewRounds)
      .where(eq(reviewRounds.id, roundId))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: "Review round not found" }, { status: 404 });
    }

    const updates: Partial<{ name: string; endDate: string | null }> = {};
    if (parsed.data.name !== undefined) {
      updates.name = parsed.data.name;
    }
    if (parsed.data.endDate !== undefined) {
      updates.endDate = parsed.data.endDate;
    }

    await db.update(reviewRounds).set(updates).where(eq(reviewRounds.id, roundId));

    const updated = await db
      .select()
      .from(reviewRounds)
      .where(eq(reviewRounds.id, roundId))
      .limit(1);

    return NextResponse.json({ round: updated[0] });
  } catch (error) {
    return handleAuthError(error);
  }
}
