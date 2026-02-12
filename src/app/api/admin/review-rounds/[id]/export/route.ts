import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/auth/middleware";
import { db } from "@/lib/db";
import { getCandidatesForRound } from "@/lib/db/queries";
import { reviewRounds } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsvRow(fields: string[]): string {
  return fields.map(escapeCsvField).join(",");
}

const CSV_HEADERS = [
  "Title",
  "Type",
  "Status",
  "Requested By",
  "Nomination",
  "Keep Seasons",
  "Season Count",
  "Community Keep Votes",
  "Admin Action",
  "Action By",
  "Action Date",
];

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

    const rows = candidates.map((c) =>
      toCsvRow([
        c.title,
        c.mediaType,
        c.status,
        c.requestedByUsername || "Unknown",
        c.nominationType === "trim" ? "trim" : "delete",
        c.keepSeasons ? String(c.keepSeasons) : "",
        c.seasonCount ? String(c.seasonCount) : "",
        String(c.keepCount ?? 0),
        c.action || "",
        c.actionByUsername || "",
        c.actedAt || "",
      ])
    );

    const csv = [toCsvRow(CSV_HEADERS), ...rows].join("\n");
    const filename = round[0].name.replace(/[^a-zA-Z0-9 _-]/g, "").trim() || "export";

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
