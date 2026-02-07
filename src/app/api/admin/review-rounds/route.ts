import { NextRequest, NextResponse } from "next/server";
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
    const { name } = reviewRoundCreateSchema.parse(body);

    // Check for existing active round
    // SQLite's single-writer lock serializes concurrent writes
    const active = await db
      .select()
      .from(reviewRounds)
      .where(eq(reviewRounds.status, "active"))
      .limit(1);

    if (active.length > 0) {
      return NextResponse.json(
        { error: "An active review round already exists. Close it before starting a new one." },
        { status: 409 }
      );
    }

    const result = await db
      .insert(reviewRounds)
      .values({
        name,
        createdByPlexId: session.plexId,
      })
      .returning();

    return NextResponse.json({ round: result[0] }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Invalid round name" }, { status: 400 });
    }
    return handleAuthError(error);
  }
}
