import { db } from "@/lib/db";
import { mediaItems, watchStatus, syncLog, users } from "@/lib/db/schema";
import { getOverseerrClient, mapMediaStatus } from "./overseerr";
import { getTautulliClient } from "./tautulli";
import { upsertUser } from "./user-upsert";
import { eq, and, ne, count, isNotNull, notInArray } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

export interface SyncProgress {
  phase: "overseerr" | "tautulli";
  step: string;
  current: number;
  total: number;
  detail?: string;
}

type ProgressCallback = (progress: SyncProgress) => void;

async function markStaleItemsRemoved(
  extraConditions: SQL[],
  synced: number,
  total: number,
  onProgress?: ProgressCallback
): Promise<number> {
  const removed = await db
    .update(mediaItems)
    .set({
      status: "removed",
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(...extraConditions, ne(mediaItems.status, "removed"), isNotNull(mediaItems.overseerrId))
    )
    .returning({ id: mediaItems.id });

  if (removed.length > 0) {
    onProgress?.({
      phase: "overseerr",
      step: `Marked ${removed.length} stale item(s) as removed`,
      current: synced,
      total,
      detail: `${removed.length} removed`,
    });
  }

  return removed.length;
}

export async function syncOverseerr(onProgress?: ProgressCallback): Promise<number> {
  const client = getOverseerrClient();

  onProgress?.({
    phase: "overseerr",
    step: "Fetching requests from Overseerr...",
    current: 0,
    total: 0,
  });
  const requests = await client.getAllRequests();
  const total = requests.length;
  onProgress?.({
    phase: "overseerr",
    step: `Found ${total} requests. Syncing...`,
    current: 0,
    total,
  });

  let synced = 0;

  for (const req of requests) {
    const tmdbId = req.media?.tmdbId;
    const mediaType = req.type;

    let title = `Unknown (TMDB: ${tmdbId})`;
    let posterPath: string | null = null;
    let imdbId: string | null = null;
    let seasonCount: number | null = null;
    let availableSeasonCount: number | null = null;

    // Try to fetch title from Overseerr
    if (tmdbId) {
      try {
        const details = await client.getMediaDetails(tmdbId, mediaType);
        title =
          details.title || details.name || details.originalTitle || details.originalName || title;
        posterPath = details.posterPath || null;
        imdbId = details.imdbId || details.externalIds?.imdbId || null;
        if (mediaType === "tv") {
          seasonCount = details.numberOfSeasons || null;
          // Overseerr season status: 4 = partially available, 5 = fully available
          const SEASON_AVAILABLE_THRESHOLD = 4;
          const seasons = details.mediaInfo?.seasons;
          if (seasons && seasons.length > 0) {
            availableSeasonCount =
              seasons.filter((s) => s.status >= SEASON_AVAILABLE_THRESHOLD).length || null;
          }
        }
      } catch {
        // Keep default title if fetch fails
      }
    }

    const requestedByPlexId = req.requestedBy?.plexId ? String(req.requestedBy.plexId) : null;

    // Upsert the requesting user if we have their info
    if (requestedByPlexId && req.requestedBy) {
      await upsertUser({
        plexId: requestedByPlexId,
        username:
          req.requestedBy.plexUsername ||
          req.requestedBy.username ||
          req.requestedBy.email ||
          "Unknown",
        email: req.requestedBy.email || null,
        avatarUrl: req.requestedBy.avatar || null,
      });
    }

    // Upsert media item
    const overseerrId = req.media?.id ?? req.id;
    await db
      .insert(mediaItems)
      .values({
        overseerrId,
        overseerrRequestId: req.id,
        tmdbId: tmdbId || null,
        tvdbId: req.media?.tvdbId || null,
        imdbId,
        mediaType,
        title,
        posterPath,
        status: mapMediaStatus(req.media?.status),
        requestedByPlexId,
        requestedAt: req.createdAt,
        ratingKey: req.media?.ratingKey || null,
        seasonCount,
        availableSeasonCount,
        lastSyncedAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: mediaItems.overseerrId,
        set: {
          title,
          posterPath,
          imdbId,
          status: mapMediaStatus(req.media?.status),
          ratingKey: req.media?.ratingKey || null,
          seasonCount,
          availableSeasonCount,
          lastSyncedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });

    synced++;
    if (synced % 5 === 0 || synced === total) {
      onProgress?.({
        phase: "overseerr",
        step: "Syncing media items...",
        current: synced,
        total,
        detail: title,
      });
    }
  }

  // Mark items no longer in Overseerr as "removed".
  // Uses media.id (overseerrId) when available, falls back to request.id.
  // This matches the upsert logic at line 80 which uses the same fallback.
  const seenOverseerrIds = requests
    .map((r) => r.media?.id ?? r.id)
    .filter((id): id is number => id != null);

  if (seenOverseerrIds.length > 0) {
    await markStaleItemsRemoved(
      [notInArray(mediaItems.overseerrId, seenOverseerrIds)],
      synced,
      total,
      onProgress
    );
  } else if (total === 0) {
    // Safety: if Overseerr returned 0 requests but we have existing items,
    // this likely indicates an API issue — skip bulk removal to prevent data loss.
    const existing = await db
      .select({ total: count() })
      .from(mediaItems)
      .where(and(ne(mediaItems.status, "removed"), isNotNull(mediaItems.overseerrId)));

    if (existing[0]?.total > 0) {
      console.warn(
        `Overseerr returned 0 requests but ${existing[0].total} items exist locally. Skipping stale removal.`
      );
    }
  }

  return synced;
}

export async function syncTautulli(onProgress?: ProgressCallback): Promise<number> {
  const client = getTautulliClient();
  let synced = 0;

  onProgress?.({
    phase: "tautulli",
    step: "Fetching media items with rating keys...",
    current: 0,
    total: 0,
  });

  // Get all media items that have a rating key
  const items = await db.select().from(mediaItems).where(isNotNull(mediaItems.ratingKey));

  const total = items.length;
  onProgress?.({
    phase: "tautulli",
    step: `Found ${total} items with rating keys. Fetching watch history...`,
    current: 0,
    total,
  });

  // Get all Tautulli users to map user_id -> plex_id
  const tautulliUsers = await client.getUsers();

  let processed = 0;
  for (const item of items) {
    if (!item.ratingKey) continue;
    processed++;

    try {
      const history = await client.getHistory(item.ratingKey);

      // Aggregate history records by user before upserting
      const byUser = new Map<
        string,
        { watched: boolean; playCount: number; lastWatchedAt: string | null }
      >();

      for (const record of history) {
        if (!record.user_id) continue;

        const tautulliUser = tautulliUsers.find((u) => u.user_id === record.user_id);
        if (!tautulliUser) continue;

        // Find matching local user
        const localUser = await db
          .select()
          .from(users)
          .where(eq(users.username, tautulliUser.friendly_name || tautulliUser.username))
          .limit(1);

        if (localUser.length === 0) continue;

        const userPlexId = localUser[0].plexId;

        const existing = byUser.get(userPlexId) || {
          watched: false,
          playCount: 0,
          lastWatchedAt: null,
        };

        existing.playCount += 1;
        if (record.watched_status === 1) existing.watched = true;
        if (record.stopped) {
          const date = new Date(record.stopped * 1000).toISOString();
          if (!existing.lastWatchedAt || date > existing.lastWatchedAt) {
            existing.lastWatchedAt = date;
          }
        }

        byUser.set(userPlexId, existing);
      }

      // Upsert aggregated watch status per user
      for (const [userPlexId, agg] of byUser) {
        const existing = await db
          .select()
          .from(watchStatus)
          .where(and(eq(watchStatus.mediaItemId, item.id), eq(watchStatus.userPlexId, userPlexId)))
          .limit(1);

        if (existing.length > 0) {
          await db
            .update(watchStatus)
            .set({
              watched: agg.watched || existing[0].watched,
              playCount: agg.playCount,
              lastWatchedAt: agg.lastWatchedAt || existing[0].lastWatchedAt,
              syncedAt: new Date().toISOString(),
            })
            .where(eq(watchStatus.id, existing[0].id));
        } else {
          await db.insert(watchStatus).values({
            mediaItemId: item.id,
            userPlexId,
            watched: agg.watched,
            playCount: agg.playCount,
            lastWatchedAt: agg.lastWatchedAt,
          });
        }

        synced++;
      }
    } catch (err) {
      console.error(`Failed to sync watch status for ${item.title}:`, err);
    }

    if (processed % 3 === 0 || processed === total) {
      onProgress?.({
        phase: "tautulli",
        step: "Syncing watch history...",
        current: processed,
        total,
        detail: item.title,
      });
    }
  }

  return synced;
}

export async function runFullSync(
  onProgress?: ProgressCallback
): Promise<{ overseerr: number; tautulli: number }> {
  const logEntry = await db
    .insert(syncLog)
    .values({
      syncType: "full",
      status: "running",
    })
    .returning();

  const logId = logEntry[0].id;

  try {
    const overseerrCount = await syncOverseerr(onProgress);
    const tautulliCount = await syncTautulli(onProgress);

    await db
      .update(syncLog)
      .set({
        status: "completed",
        itemsSynced: overseerrCount + tautulliCount,
        completedAt: new Date().toISOString(),
      })
      .where(eq(syncLog.id, logId));

    return { overseerr: overseerrCount, tautulli: tautulliCount };
  } catch (err) {
    await db
      .update(syncLog)
      .set({
        status: "failed",
        errors: JSON.stringify({ message: String(err) }),
        completedAt: new Date().toISOString(),
      })
      .where(eq(syncLog.id, logId));

    throw err;
  }
}
