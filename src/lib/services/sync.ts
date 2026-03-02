import { db } from "@/lib/db";
import { mediaItems, watchStatus, syncLog, users } from "@/lib/db/schema";
import { mapMediaStatus } from "./overseerr";
import { getRequestServiceClient, getProviderLabel, getActiveProvider } from "./request-service";
import { getServiceConfig, getActiveStatsProvider } from "./service-config";
import { createTautulliClient } from "./tautulli";
import { createTracearrClient } from "./tracearr";
import { upsertUser } from "./user-upsert";
import { eq, and, ne, count, isNotNull, notInArray } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

type TautulliClientType = ReturnType<typeof createTautulliClient>;

export interface SyncProgress {
  phase: "overseerr" | "tautulli" | "tracearr";
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
  const client = await getRequestServiceClient();
  const providerLabel = await getProviderLabel();

  onProgress?.({
    phase: "overseerr",
    step: `Fetching requests from ${providerLabel}...`,
    current: 0,
    total: 0,
  });

  let requests;
  try {
    requests = await client.getAllRequests();
  } catch (err) {
    if (err instanceof TypeError && err.message.includes("fetch failed")) {
      const activeProvider = await getActiveProvider();
      const config = await getServiceConfig(activeProvider);
      throw new Error(
        `Could not connect to ${providerLabel} at ${config?.url || "unknown URL"} — check that the service is running and reachable`
      );
    }
    throw err;
  }
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
          const seasons = details.mediaInfo?.seasons as
            | { seasonNumber: number; status: number }[]
            | undefined;
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

/**
 * Fetch TV show file sizes by querying the Plex server for all episodes
 * and aggregating by show (grandparentRatingKey).
 *
 * Tautulli's get_library_media_info does not return file sizes for TV shows,
 * so we query the Plex server directly via its API. The Plex server URL comes
 * from Tautulli's get_server_info and the token from the admin user in our DB.
 */
async function fetchPlexTvFileSizes(
  client: TautulliClientType,
  sectionIds: string[]
): Promise<Map<string, number>> {
  const fileSizeMap = new Map<string, number>();

  // Get Plex server URL from Tautulli
  const { pmsUrl } = await client.getServerInfo();

  // Get admin Plex token from our DB
  const admin = await db.select().from(users).where(eq(users.isAdmin, true)).limit(1);
  const plexToken = admin[0]?.plexToken;
  if (!plexToken) return fileSizeMap;

  for (const sectionId of sectionIds) {
    // type=4 = episodes; this returns all episodes in one call
    const url = `${pmsUrl}/library/sections/${sectionId}/all?type=4`;
    const res = await fetch(url, {
      headers: { Accept: "application/json", "X-Plex-Token": plexToken },
    });
    if (!res.ok) continue;

    const json = await res.json();
    const episodes = json?.MediaContainer?.Metadata;
    if (!Array.isArray(episodes)) continue;

    for (const ep of episodes) {
      const showRatingKey = ep.grandparentRatingKey;
      if (!showRatingKey) continue;
      const key = String(showRatingKey);

      for (const media of ep.Media ?? []) {
        for (const part of media.Part ?? []) {
          if (part.size && Number(part.size) > 0) {
            fileSizeMap.set(key, (fileSizeMap.get(key) || 0) + Number(part.size));
          }
        }
      }
    }
  }

  return fileSizeMap;
}

export async function syncTautulli(onProgress?: ProgressCallback): Promise<number> {
  const tautulliConfig = await getServiceConfig("tautulli");
  if (!tautulliConfig) {
    throw new Error(
      "Tautulli is not configured. Set TAUTULLI_URL/TAUTULLI_API_KEY or configure in Admin > Settings."
    );
  }
  const client = createTautulliClient(tautulliConfig);
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
  let tautulliUsers;
  try {
    tautulliUsers = await client.getUsers();
  } catch (err) {
    if (err instanceof TypeError && err.message.includes("fetch failed")) {
      throw new Error(
        `Could not connect to Tautulli at ${tautulliConfig.url} — check that the service is running and reachable`
      );
    }
    throw err;
  }

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

  // Sync file sizes: Tautulli first, Plex API as fallback for missing items
  try {
    onProgress?.({
      phase: "tautulli",
      step: "Syncing file sizes...",
      current: processed,
      total,
    });

    const fileSizeMap = new Map<string, number>();

    // Primary: Tautulli's get_library_media_info returns file sizes for all
    // library types. Works reliably for movies; for TV shows, requires the
    // "Calculate Total File Sizes" setting enabled in Tautulli.
    const libraries = await client.getLibraries();
    for (const lib of libraries) {
      const sectionId = String(lib.section_id);
      const mediaInfo = await client.getLibraryMediaInfo(sectionId);
      for (const item of mediaInfo) {
        if (item.rating_key && item.file_size) {
          const size = Number(item.file_size);
          if (size > 0) {
            const key = String(item.rating_key);
            fileSizeMap.set(key, (fileSizeMap.get(key) || 0) + size);
          }
        }
      }
    }

    // Plex fallback: for any items where Tautulli returned no file sizes
    // (typically TV show libraries), query the Plex server directly.
    const hasMissing = items.some((i) => i.ratingKey && !fileSizeMap.has(i.ratingKey));

    if (hasMissing) {
      // Identify which library sections have missing items
      const sectionsToFetch = libraries
        .filter((l) => l.section_type === "show")
        .map((l) => String(l.section_id));

      if (sectionsToFetch.length > 0) {
        const plexSizes = await fetchPlexTvFileSizes(client, sectionsToFetch);
        for (const [rk, size] of plexSizes) {
          if (!fileSizeMap.has(rk)) {
            fileSizeMap.set(rk, size);
          }
        }
      }
    }

    // Update media items with file sizes
    const now = new Date().toISOString();
    for (const item of items) {
      if (!item.ratingKey) continue;
      const size = fileSizeMap.get(item.ratingKey);
      if (size !== undefined) {
        await db
          .update(mediaItems)
          .set({ fileSize: size, updatedAt: now })
          .where(eq(mediaItems.id, item.id));
      }
    }

    onProgress?.({
      phase: "tautulli",
      step: `Updated file sizes for ${fileSizeMap.size} items`,
      current: total,
      total,
    });
  } catch (err) {
    console.error("Failed to sync file sizes:", err);
  }

  return synced;
}

/**
 * Build a title-based lookup key for matching Tracearr sessions to local media items.
 * Tracearr's public API does not expose ratingKey or tmdbId, so we match by title.
 * Year is included when available to disambiguate remakes/reboots (e.g. "The Office (2005)").
 *
 * For movies: normalize(mediaTitle) + optional year
 * For episodes: normalize(showTitle) + optional year — matches to the parent TV show
 */
function buildTitleKey(title: string, year?: number | null): string {
  const normalized = title.trim().toLowerCase();
  return year ? `${normalized} (${year})` : normalized;
}

export async function syncTracearr(onProgress?: ProgressCallback): Promise<number> {
  const tracearrConfig = await getServiceConfig("tracearr");
  if (!tracearrConfig) {
    throw new Error(
      "Tracearr is not configured. Set TRACEARR_URL/TRACEARR_API_KEY or configure in Admin > Settings."
    );
  }
  const client = createTracearrClient(tracearrConfig);
  let synced = 0;

  onProgress?.({
    phase: "tracearr",
    step: "Fetching all watch history from Tracearr...",
    current: 0,
    total: 0,
  });

  // Fetch all history in one paginated pass
  let allSessions;
  try {
    allSessions = await client.getAllHistory();
  } catch (err) {
    if (err instanceof TypeError && err.message.includes("fetch failed")) {
      throw new Error(
        `Could not connect to Tracearr at ${tracearrConfig.url} — check that the service is running and reachable`
      );
    }
    throw err;
  }

  onProgress?.({
    phase: "tracearr",
    step: `Fetched ${allSessions.length} sessions. Processing...`,
    current: 0,
    total: allSessions.length,
  });

  // Build a map of titleKey -> username -> aggregated watch data.
  // Tracearr's public API does NOT expose ratingKey, so we match by title.
  // For movies: use mediaTitle; for episodes: use showTitle (the parent show name).
  // Year is included when available to disambiguate remakes/reboots.
  type WatchAgg = { watched: boolean; playCount: number; lastWatchedAt: string | null };
  const watchMap = new Map<string, Map<string, WatchAgg>>();

  for (const session of allSessions) {
    // For episodes, match by the parent show title; for movies, match by media title
    const matchTitle =
      session.mediaType === "episode" && session.showTitle ? session.showTitle : session.mediaTitle;
    if (!matchTitle) continue;

    const titleKey = buildTitleKey(matchTitle, session.year);
    const username = session.user.username;

    if (!watchMap.has(titleKey)) {
      watchMap.set(titleKey, new Map());
    }
    const userMap = watchMap.get(titleKey)!;
    const existing = userMap.get(username) || {
      watched: false,
      playCount: 0,
      lastWatchedAt: null,
    };

    existing.playCount += 1;
    if (session.watched) existing.watched = true;
    if (session.stoppedAt) {
      if (!existing.lastWatchedAt || session.stoppedAt > existing.lastWatchedAt) {
        existing.lastWatchedAt = session.stoppedAt;
      }
    } else if (session.startedAt) {
      if (!existing.lastWatchedAt || session.startedAt > existing.lastWatchedAt) {
        existing.lastWatchedAt = session.startedAt;
      }
    }

    userMap.set(username, existing);
  }

  // Get all media items from our DB
  const items = await db.select().from(mediaItems);

  const total = items.length;
  let processed = 0;

  onProgress?.({
    phase: "tracearr",
    step: `Matching ${watchMap.size} watched titles against ${total} media items...`,
    current: 0,
    total,
  });

  // Pre-load all users into a map to avoid N+1 queries
  const allUsers = await db.select().from(users);
  const usersByUsername = new Map<string, string>();
  for (const u of allUsers) {
    usersByUsername.set(u.username, u.plexId);
  }

  // Pre-load all existing watch_status rows into a map
  const allWatchStatus = await db.select().from(watchStatus);
  const watchStatusMap = new Map<string, (typeof allWatchStatus)[number]>();
  for (const ws of allWatchStatus) {
    watchStatusMap.set(`${ws.mediaItemId}:${ws.userPlexId}`, ws);
  }

  for (const item of items) {
    processed++;

    // Try with year first (from tmdbId-based data we don't have year in schema,
    // but the title key from Tracearr may include year), then fall back to title-only
    const titleKey = buildTitleKey(item.title);
    const userWatchData = watchMap.get(titleKey);
    if (!userWatchData) continue;

    for (const [username, agg] of userWatchData) {
      const userPlexId = usersByUsername.get(username);
      if (!userPlexId) continue;

      const wsKey = `${item.id}:${userPlexId}`;
      const existingRow = watchStatusMap.get(wsKey);

      if (existingRow) {
        await db
          .update(watchStatus)
          .set({
            watched: agg.watched || existingRow.watched,
            playCount: agg.playCount,
            lastWatchedAt: agg.lastWatchedAt || existingRow.lastWatchedAt,
            syncedAt: new Date().toISOString(),
          })
          .where(eq(watchStatus.id, existingRow.id));
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

    if (processed % 10 === 0 || processed === total) {
      onProgress?.({
        phase: "tracearr",
        step: "Syncing watch history...",
        current: processed,
        total,
        detail: item.title,
      });
    }
  }

  onProgress?.({
    phase: "tracearr",
    step: `Synced ${synced} watch status records from Tracearr`,
    current: total,
    total,
  });

  return synced;
}

/**
 * Resolves the active stats provider and runs the appropriate sync.
 * Auto-detect checks Tautulli first, then Tracearr.
 */
export async function syncWatchHistory(onProgress?: ProgressCallback): Promise<number> {
  const setting = await getActiveStatsProvider();

  if (setting === "tracearr") {
    return syncTracearr(onProgress);
  }

  if (setting === "tautulli") {
    return syncTautulli(onProgress);
  }

  // Auto-detect: try Tautulli first, then Tracearr
  const tautulliConfig = await getServiceConfig("tautulli");
  if (tautulliConfig) {
    return syncTautulli(onProgress);
  }

  const tracearrConfig = await getServiceConfig("tracearr");
  if (tracearrConfig) {
    return syncTracearr(onProgress);
  }

  throw new Error("No stats provider configured. Set up Tautulli or Tracearr in Admin > Settings.");
}

export type FullSyncResult = {
  overseerr: number;
  tautulli?: number;
  tracearr?: number;
};

export async function runFullSync(onProgress?: ProgressCallback): Promise<FullSyncResult> {
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

    // Resolve which stats provider will run so we can label the result correctly
    const statsSetting = await getActiveStatsProvider();
    let resolvedStatsProvider: "tautulli" | "tracearr" = "tautulli";
    if (statsSetting === "tracearr") {
      resolvedStatsProvider = "tracearr";
    } else if (statsSetting === "auto") {
      const tautulliConfig = await getServiceConfig("tautulli");
      if (!tautulliConfig) {
        const tracearrConfig = await getServiceConfig("tracearr");
        if (tracearrConfig) resolvedStatsProvider = "tracearr";
      }
    }

    const statsCount = await syncWatchHistory(onProgress);

    await db
      .update(syncLog)
      .set({
        status: "completed",
        itemsSynced: overseerrCount + statsCount,
        completedAt: new Date().toISOString(),
      })
      .where(eq(syncLog.id, logId));

    return {
      overseerr: overseerrCount,
      [resolvedStatsProvider]: statsCount,
    } as FullSyncResult;
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
