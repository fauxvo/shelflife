import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/auth/middleware";
import { getOverseerrClient } from "@/lib/services/overseerr";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tmdbId: string }> }
) {
  try {
    await requireAdmin();
    const { tmdbId } = await params;
    const id = Number(tmdbId);

    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid TMDB ID" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const mediaType = searchParams.get("type");

    if (mediaType !== "movie" && mediaType !== "tv") {
      return NextResponse.json(
        { error: "Invalid type — must be 'movie' or 'tv'" },
        { status: 400 }
      );
    }

    const client = getOverseerrClient();
    const details = await client.getMediaDetails(id, mediaType);

    return NextResponse.json({
      overview: details.overview ?? null,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
