import { db } from "@/lib/db";
import { mediaItems, deletionLog } from "@/lib/db/schema";
import { eq, and, ne } from "drizzle-orm";
import type { DeletionResult, DeletionServiceStatus } from "@/types";
import { isSonarrConfigured, getSonarrClient } from "./sonarr";
import { isRadarrConfigured, getRadarrClient } from "./radarr";
import { getOverseerrClient } from "./overseerr";

export function getDeletionServiceStatus(): DeletionServiceStatus {
  return {
    sonarr: isSonarrConfigured(),
    radarr: isRadarrConfigured(),
    overseerr: true,
  };
}

export async function executeMediaDeletion(params: {
  mediaItemId: number;
  deleteFiles: boolean;
  deletedByPlexId: string;
  reviewRoundId?: number;
}): Promise<DeletionResult> {
  const { mediaItemId, deleteFiles, deletedByPlexId, reviewRoundId } = params;

  // Fetch the media item from DB
  const [mediaItem] = await db.select().from(mediaItems).where(eq(mediaItems.id, mediaItemId));

  if (!mediaItem) {
    throw new Error(`Media item not found: ${mediaItemId}`);
  }

  if (mediaItem.status === "removed") {
    throw new Error(`Media item already removed: ${mediaItemId}`);
  }

  // Claim the item by setting status to "removed" before external calls
  // This narrows the race window for concurrent deletion attempts
  const claimed = await db
    .update(mediaItems)
    .set({ status: "removed", updatedAt: new Date().toISOString() })
    .where(and(eq(mediaItems.id, mediaItemId), ne(mediaItems.status, "removed")));

  if (claimed.changes === 0) {
    throw new Error(`Media item already removed: ${mediaItemId}`);
  }

  // Initialize result
  const result: DeletionResult = {
    mediaItemId,
    sonarr: { attempted: false, success: null },
    radarr: { attempted: false, success: null },
    overseerr: { attempted: false, success: null },
  };

  // Sonarr deletion for TV shows
  if (mediaItem.mediaType === "tv" && isSonarrConfigured() && mediaItem.tvdbId) {
    result.sonarr.attempted = true;
    try {
      const client = getSonarrClient();
      const series = await client.lookupByTvdbId(mediaItem.tvdbId);
      if (series) {
        const seriesId = Number(series.id);
        if (!seriesId) throw new Error(`Invalid Sonarr series ID for tvdbId ${mediaItem.tvdbId}`);
        await client.deleteSeries(seriesId, deleteFiles);
      }
      // If lookup returns null, the series is already gone -- treat as success
      result.sonarr.success = true;
    } catch (e) {
      result.sonarr.success = false;
      result.sonarr.error = e instanceof Error ? e.message : String(e);
    }
  }

  // Radarr deletion for movies
  if (mediaItem.mediaType === "movie" && isRadarrConfigured() && mediaItem.tmdbId) {
    result.radarr.attempted = true;
    try {
      const client = getRadarrClient();
      const movie = await client.lookupByTmdbId(mediaItem.tmdbId);
      if (movie) {
        const movieId = Number(movie.id);
        if (!movieId) throw new Error(`Invalid Radarr movie ID for tmdbId ${mediaItem.tmdbId}`);
        await client.deleteMovie(movieId, deleteFiles);
      }
      // If lookup returns null, the movie is already gone -- treat as success
      result.radarr.success = true;
    } catch (e) {
      result.radarr.success = false;
      result.radarr.error = e instanceof Error ? e.message : String(e);
    }
  }

  // Overseerr deletion
  if (mediaItem.overseerrId) {
    result.overseerr.attempted = true;
    try {
      const client = getOverseerrClient();
      await client.deleteMedia(mediaItem.overseerrId);
      result.overseerr.success = true;
    } catch (e) {
      result.overseerr.success = false;
      result.overseerr.error = e instanceof Error ? e.message : String(e);
    }
  }

  // Collect non-null error messages
  const errors: string[] = [];
  if (result.sonarr.error) errors.push(`sonarr: ${result.sonarr.error}`);
  if (result.radarr.error) errors.push(`radarr: ${result.radarr.error}`);
  if (result.overseerr.error) errors.push(`overseerr: ${result.overseerr.error}`);

  // Insert deletion log entry
  await db.insert(deletionLog).values({
    mediaItemId,
    reviewRoundId: reviewRoundId ?? null,
    deletedByPlexId,
    deleteFiles,
    sonarrSuccess: result.sonarr.success,
    radarrSuccess: result.radarr.success,
    overseerrSuccess: result.overseerr.success,
    errors: errors.length > 0 ? JSON.stringify(errors) : null,
  });

  return result;
}
