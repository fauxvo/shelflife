import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/auth/middleware";
import { reviewRoundCreateSchema } from "@/lib/validators/schemas";
import { db, sqlite } from "@/lib/db";
import { reviewRounds, reviewActions } from "@/lib/db/schema";
import { eq, desc, count } from "drizzle-orm";

export async function GET() {
  try {
    await requireAdmin();

    const actionCounts = db
      .select({
        reviewRoundId: reviewActions.reviewRoundId,
        actionCount: count().as("action_count"),
      })
      .from(reviewActions)
      .groupBy(reviewActions.reviewRoundId)
      .as("action_counts");

    const rounds = await db
      .select({
        id: reviewRounds.id,
        name: reviewRounds.name,
        status: reviewRounds.status,
        startedAt: reviewRounds.startedAt,
        closedAt: reviewRounds.closedAt,
        endDate: reviewRounds.endDate,
        createdByPlexId: reviewRounds.createdByPlexId,
        actionCount: actionCounts.actionCount,
      })
      .from(reviewRounds)
      .leftJoin(actionCounts, eq(actionCounts.reviewRoundId, reviewRounds.id))
      .orderBy(desc(reviewRounds.startedAt));

    return NextResponse.json({
      rounds: rounds.map((r) => ({
        ...r,
        actionCount: Number(r.actionCount) || 0,
      })),
    });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();

    const body = await request.json();
    const { name, endDate } = reviewRoundCreateSchema.parse(body);

    // Atomic check + insert via synchronous better-sqlite3 transaction
    // prevents race condition where two concurrent requests both pass the check
    const createRound = sqlite.transaction(() => {
      const active = sqlite
        .prepare("SELECT id FROM review_rounds WHERE status = 'active' LIMIT 1")
        .get();
      if (active) return null;

      return sqlite
        .prepare(
          "INSERT INTO review_rounds (name, end_date, created_by_plex_id) VALUES (?, ?, ?) RETURNING *"
        )
        .get(name, endDate ?? null, session.plexId) as Record<string, unknown>;
    });

    const row = createRound();

    if (!row) {
      return NextResponse.json(
        { error: "An active review round already exists. Close it before starting a new one." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        round: {
          id: row.id,
          name: row.name,
          status: row.status,
          startedAt: row.started_at,
          closedAt: row.closed_at,
          endDate: row.end_date ?? null,
          createdByPlexId: row.created_by_plex_id,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Invalid round name" }, { status: 400 });
    }
    return handleAuthError(error);
  }
}
