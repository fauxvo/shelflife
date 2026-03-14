import { db } from "@/lib/db";
import { mediaItems, deletionLog } from "@/lib/db/schema";
import { eq, and, ne } from "drizzle-orm";
import type { DeletionResult, DeletionServiceStatus } from "@/types";
import { getServiceConfig } from "./service-config";
import { createSonarrClient } from "./sonarr";
import { createRadarrClient } from "./radarr";
import { getRequestServiceClient, getActiveProvider } from "./request-service";

export async function getDeletionServiceStatus(): Promise<DeletionServiceStatus> {
  const [sonarrConfig, radarrConfig] = await Promise.all([
    getServiceConfig("sonarr"),
    getServiceConfig("radarr"),
  ]);
  // Check if Seerr is actually configured
  let seerrConfigured = false;
  try {
    await getActiveProvider();
    seerrConfigured = true;
  } catch {
    // No Seerr configured
  }
  return {
    sonarr: sonarrConfig !== null,
    radarr: radarrConfig !== null,
    overseerr: seerrConfigured,
  };
}

/**
 * Orchestrates media deletion across Sonarr/Radarr and Overseerr.
 *
 * Race condition strategy: Before making any external API calls, this function
 * claims the media item by atomically updating its status to "removed" with a
 * conditional WHERE clause (`status != 'removed'`). If a concurrent call already
 * claimed the item, `claimed.changes` will be 0 and we throw early. This narrows
 * the race window to the DB write rather than the full external-API round trip.
 *
 * Deletion order: Sonarr/Radarr first (actual media files), then Overseerr
 * (request tracking). Each service call is independently try/caught so partial
 * failures don't prevent other services from being cleaned up.
 *
 * All results — including per-service success/failure and error messages — are
 * written to the `deletion_log` table for audit purposes.
 */
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
  // Prefer direct sonarrId (from *arr sync) over tvdbId lookup
  const sonarrConfig = mediaItem.mediaType === "tv" ? await getServiceConfig("sonarr") : null;
  if (sonarrConfig && (mediaItem.sonarrId || mediaItem.tvdbId)) {
    result.sonarr.attempted = true;
    try {
      const client = createSonarrClient(sonarrConfig);
      if (mediaItem.sonarrId) {
        await client.deleteSeries(mediaItem.sonarrId, deleteFiles);
      } else if (mediaItem.tvdbId) {
        const series = await client.lookupByTvdbId(mediaItem.tvdbId);
        if (series) {
          await client.deleteSeries(series.id, deleteFiles);
        }
      }
      // If lookup returns null, the series is already gone -- treat as success
      result.sonarr.success = true;
    } catch (e) {
      result.sonarr.success = false;
      result.sonarr.error = e instanceof Error ? e.message : String(e);
    }
  }

  // Radarr deletion for movies
  // Prefer direct radarrId (from *arr sync) over tmdbId lookup
  const radarrConfig = mediaItem.mediaType === "movie" ? await getServiceConfig("radarr") : null;
  if (radarrConfig && (mediaItem.radarrId || mediaItem.tmdbId)) {
    result.radarr.attempted = true;
    try {
      const client = createRadarrClient(radarrConfig);
      if (mediaItem.radarrId) {
        await client.deleteMovie(mediaItem.radarrId, deleteFiles);
      } else if (mediaItem.tmdbId) {
        const movie = await client.lookupByTmdbId(mediaItem.tmdbId);
        if (movie) {
          await client.deleteMovie(movie.id, deleteFiles);
        }
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
      const client = await getRequestServiceClient();
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
