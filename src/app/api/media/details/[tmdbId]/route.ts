import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";
import { getOverseerrClient } from "@/lib/services/overseerr";
import { mediaDetailsQuerySchema } from "@/lib/validators/schemas";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tmdbId: string }> }
) {
  try {
    await requireAuth();
    const { tmdbId } = await params;
    const id = Number(tmdbId);

    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid TMDB ID" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const parsed = mediaDetailsQuerySchema.safeParse({
      type: searchParams.get("type"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid type — must be 'movie' or 'tv'" },
        { status: 400 }
      );
    }

    const client = getOverseerrClient();
    const details = await client.getMediaDetails(id, parsed.data.type);

    return NextResponse.json({
      overview: details.overview ?? null,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
