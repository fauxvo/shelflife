import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/auth/middleware";
import { db } from "@/lib/db";
import { reviewRounds } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const roundId = Number(id);

    if (isNaN(roundId)) {
      return NextResponse.json({ error: "Invalid round ID" }, { status: 400 });
    }

    const round = await db
      .select()
      .from(reviewRounds)
      .where(and(eq(reviewRounds.id, roundId), eq(reviewRounds.status, "active")))
      .limit(1);

    if (round.length === 0) {
      return NextResponse.json(
        { error: "Review round not found or already closed" },
        { status: 404 }
      );
    }

    await db
      .update(reviewRounds)
      .set({
        status: "closed",
        closedAt: new Date().toISOString(),
      })
      .where(eq(reviewRounds.id, roundId));

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
