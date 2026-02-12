import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAdmin, handleAuthError } from "@/lib/auth/middleware";
import { reviewRoundCreateSchema } from "@/lib/validators/schemas";
import { db } from "@/lib/db";
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

    // Atomic check + insert via transaction prevents race condition
    // where two concurrent requests both pass the active-round check
    const row = db.transaction((tx) => {
      const active = tx
        .select({ id: reviewRounds.id })
        .from(reviewRounds)
        .where(eq(reviewRounds.status, "active"))
        .limit(1)
        .get();
      if (active) return null;

      return tx
        .insert(reviewRounds)
        .values({
          name,
          endDate: endDate ?? null,
          createdByPlexId: session.plexId,
        })
        .returning()
        .get();
    });

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
          startedAt: row.startedAt,
          closedAt: row.closedAt,
          endDate: row.endDate ?? null,
          createdByPlexId: row.createdByPlexId,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid request data" }, { status: 400 });
    }
    return handleAuthError(error);
  }
}
