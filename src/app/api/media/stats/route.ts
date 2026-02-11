import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import { computeMediaStats } from "@/lib/db/queries";
import { statsQuerySchema } from "@/lib/validators/schemas";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    const params = Object.fromEntries(request.nextUrl.searchParams);
    const query = statsQuerySchema.parse(params);

    const stats = await computeMediaStats(session.plexId, query.scope);

    return NextResponse.json(stats);
  } catch (error) {
    return handleAuthError(error);
  }
}
