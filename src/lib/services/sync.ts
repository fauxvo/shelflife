import { db } from "@/lib/db";
import { mediaItems, watchStatus, syncLog, users } from "@/lib/db/schema";
import { mapMediaStatus } from "./seerr-client";
import { getRequestServiceClient, getProviderLabel, getActiveProvider } from "./request-service";
import { getServiceConfig, getActiveStatsProvider } from "./service-config";
import { createTautulliClient } from "./tautulli";
import { createTracearrClient } from "./tracearr";
import { createSonarrClient, extractSonarrPoster } from "./sonarr";
import { createRadarrClient, extractRadarrPoster } from "./radarr";
import { upsertUser } from "./user-upsert";
import { debug } from "@/lib/debug";
import { eq, and, ne, count, isNotNull, notInArray, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

type TautulliClientType = ReturnType<typeof createTautulliClient>;

export interface SyncProgress {
  phase: "sonarr" | "radarr" | "seerr" | "overseerr" | "tautulli" | "tracearr";
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
  phase: SyncProgress["phase"],
  onProgress?: ProgressCallback
): Promise<number> {
  const removed = await db
    .update(mediaItems)
    .set({
      status: "removed",
      updatedAt: new Date().toISOString(),
    })
    .where(and(...extraConditions, ne(mediaItems.status, "removed")))
    .returning({ id: mediaItems.id });

  if (removed.length > 0) {
    onProgress?.({
      phase,
      step: `Marked ${removed.length} stale item(s) as removed`,
      current: synced,
      total,
      detail: `${removed.length} removed`,
    });
  }

  return removed.length;
}

// ---------------------------------------------------------------------------
// Legacy item adoption — shared by Sonarr and Radarr sync
// ---------------------------------------------------------------------------

/**
 * Adopt a legacy Seerr-sourced item by assigning an *arr ID to it.
 * Handles deduplication when a separate *arr item already exists for the same content.
 * Returns true if an existing item was adopted, false if a new upsert is needed.
 */
function adoptLegacyItem(opts: {
  tmdbId: number;
  mediaType: "tv" | "movie";
  arrIdColumn: "sonarrId" | "radarrId";
  arrId: number;
  fields: Record<string, unknown>;
  now: string;
}): boolean {
  const { tmdbId, mediaType, arrIdColumn, arrId, fields, now } = opts;

  // Use a synchronous transaction so that clear → adopt → delete is atomic.
  // If the process crashes mid-sequence, the entire transaction rolls back
  // and the next sync run will retry cleanly.
  return db.transaction((tx) => {
    const legacyMatch = tx
      .select({ id: mediaItems.id })
      .from(mediaItems)
      .where(
        and(
          eq(mediaItems.tmdbId, tmdbId),
          eq(mediaItems.mediaType, mediaType),
          sql`${mediaItems[arrIdColumn]} IS NULL`
        )
      )
      .limit(1)
      .all();

    if (legacyMatch.length === 0) return false;

    const existingArr = tx
      .select({ id: mediaItems.id })
      .from(mediaItems)
      .where(eq(mediaItems[arrIdColumn], arrId))
      .limit(1)
      .all();

    if (existingArr.length > 0 && existingArr[0].id !== legacyMatch[0].id) {
      // Duplicate: clear → adopt → delete in one atomic transaction
      tx.update(mediaItems)
        .set({ [arrIdColumn]: null, updatedAt: now })
        .where(eq(mediaItems.id, existingArr[0].id))
        .run();
      tx.update(mediaItems)
        .set({ [arrIdColumn]: arrId, ...fields, updatedAt: now })
        .where(eq(mediaItems.id, legacyMatch[0].id))
        .run();
      try {
        tx.delete(mediaItems).where(eq(mediaItems.id, existingArr[0].id)).run();
      } catch {
        tx.update(mediaItems)
          .set({ status: "removed", updatedAt: now })
          .where(eq(mediaItems.id, existingArr[0].id))
          .run();
      }
    } else {
      // No conflict — adopt the legacy item
      tx.update(mediaItems)
        .set({ [arrIdColumn]: arrId, ...fields, updatedAt: now })
        .where(eq(mediaItems.id, legacyMatch[0].id))
        .run();
    }

    return true;
  });
}

// ---------------------------------------------------------------------------
// Sonarr sync — primary TV content source
// ---------------------------------------------------------------------------

export async function syncSonarr(onProgress?: ProgressCallback): Promise<number> {
  const sonarrConfig = await getServiceConfig("sonarr");
  if (!sonarrConfig) {
    throw new Error(
      "Sonarr is not configured. Set SONARR_URL/SONARR_API_KEY or configure in Admin > Settings."
    );
  }
  const client = createSonarrClient(sonarrConfig);

  onProgress?.({
    phase: "sonarr",
    step: "Fetching all series from Sonarr...",
    current: 0,
    total: 0,
  });

  let allSeries;
  try {
    allSeries = await client.getAllSeries();
  } catch (err) {
    if (err instanceof TypeError && err.message.includes("fetch failed")) {
      throw new Error(
        `Could not connect to Sonarr at ${sonarrConfig.url} — check that the service is running and reachable`
      );
    }
    throw err;
  }

  const total = allSeries.length;
  onProgress?.({
    phase: "sonarr",
    step: `Found ${total} series. Syncing...`,
    current: 0,
    total,
  });

  let synced = 0;
  const seenSonarrIds: number[] = [];
  const now = new Date().toISOString();

  for (const series of allSeries) {
    seenSonarrIds.push(series.id);

    const posterPath = extractSonarrPoster(series.images);
    const fields = {
      title: series.title,
      tvdbId: series.tvdbId ?? null,
      tmdbId: series.tmdbId ?? null,
      imdbId: series.imdbId || null,
      mediaType: "tv" as const,
      posterPath,
      fileSize: series.sizeOnDisk ?? null,
      addedAt: series.added || null,
      seasonCount: series.seasonCount ?? null,
      availableSeasonCount: (() => {
        const stats = series.statistics;
        if (!stats || stats.episodeFileCount === 0) return null;
        // Only report full season count when all episodes are downloaded;
        // partial shows get null — Seerr enrichment has per-season status data
        // for more accurate counts when available.
        if (stats.episodeFileCount >= stats.episodeCount) return series.seasonCount ?? null;
        return null;
      })(),
      status: (() => {
        const stats = series.statistics;
        if (!stats || stats.episodeFileCount === 0) return "pending" as const;
        if (stats.episodeFileCount < stats.episodeCount) return "partial" as const;
        return "available" as const;
      })(),
      lastSyncedAt: now,
    };

    // Adopt legacy Seerr-sourced item or upsert as new
    const adopted = series.tmdbId
      ? adoptLegacyItem({
          tmdbId: series.tmdbId,
          mediaType: "tv",
          arrIdColumn: "sonarrId",
          arrId: series.id,
          fields,
          now,
        })
      : false;

    if (!adopted) {
      await db
        .insert(mediaItems)
        .values({ sonarrId: series.id, ...fields })
        .onConflictDoUpdate({
          target: mediaItems.sonarrId,
          set: { ...fields, updatedAt: now },
        });
    }

    synced++;
    if (synced % 10 === 0 || synced === total) {
      onProgress?.({
        phase: "sonarr",
        step: "Syncing TV series...",
        current: synced,
        total,
        detail: series.title,
      });
    }
  }

  // Stale removal: items with sonarrId NOT IN seen AND sonarrId IS NOT NULL
  if (seenSonarrIds.length > 0) {
    await markStaleItemsRemoved(
      [notInArray(mediaItems.sonarrId, seenSonarrIds), isNotNull(mediaItems.sonarrId)],
      synced,
      total,
      "sonarr",
      onProgress
    );
  } else if (total === 0) {
    // Safety: if Sonarr returned 0 series but items exist locally, skip removal
    const existing = await db
      .select({ total: count() })
      .from(mediaItems)
      .where(and(ne(mediaItems.status, "removed"), isNotNull(mediaItems.sonarrId)));

    if (existing[0]?.total > 0) {
      console.warn(
        `Sonarr returned 0 series but ${existing[0].total} items exist locally. Skipping stale removal.`
      );
    }
  }

  return synced;
}

// ---------------------------------------------------------------------------
// Radarr sync — primary movie content source
// ---------------------------------------------------------------------------

export async function syncRadarr(onProgress?: ProgressCallback): Promise<number> {
  const radarrConfig = await getServiceConfig("radarr");
  if (!radarrConfig) {
    throw new Error(
      "Radarr is not configured. Set RADARR_URL/RADARR_API_KEY or configure in Admin > Settings."
    );
  }
  const client = createRadarrClient(radarrConfig);

  onProgress?.({
    phase: "radarr",
    step: "Fetching all movies from Radarr...",
    current: 0,
    total: 0,
  });

  let allMovies;
  try {
    allMovies = await client.getAllMovies();
  } catch (err) {
    if (err instanceof TypeError && err.message.includes("fetch failed")) {
      throw new Error(
        `Could not connect to Radarr at ${radarrConfig.url} — check that the service is running and reachable`
      );
    }
    throw err;
  }

  const total = allMovies.length;
  onProgress?.({
    phase: "radarr",
    step: `Found ${total} movies. Syncing...`,
    current: 0,
    total,
  });

  let synced = 0;
  const seenRadarrIds: number[] = [];
  const now = new Date().toISOString();

  for (const movie of allMovies) {
    seenRadarrIds.push(movie.id);

    const posterPath = extractRadarrPoster(movie.images);
    const fields = {
      title: movie.title,
      tmdbId: movie.tmdbId ?? null,
      imdbId: movie.imdbId || null,
      mediaType: "movie" as const,
      posterPath,
      fileSize: movie.sizeOnDisk ?? null,
      addedAt: movie.added || null,
      status: (movie.hasFile ? "available" : "pending") as "available" | "pending",
      lastSyncedAt: now,
    };

    // Adopt legacy Seerr-sourced item or upsert as new
    const adopted = movie.tmdbId
      ? adoptLegacyItem({
          tmdbId: movie.tmdbId,
          mediaType: "movie",
          arrIdColumn: "radarrId",
          arrId: movie.id,
          fields,
          now,
        })
      : false;

    if (!adopted) {
      await db
        .insert(mediaItems)
        .values({ radarrId: movie.id, ...fields })
        .onConflictDoUpdate({
          target: mediaItems.radarrId,
          set: { ...fields, updatedAt: now },
        });
    }

    synced++;
    if (synced % 10 === 0 || synced === total) {
      onProgress?.({
        phase: "radarr",
        step: "Syncing movies...",
        current: synced,
        total,
        detail: movie.title,
      });
    }
  }

  // Stale removal: items with radarrId NOT IN seen AND radarrId IS NOT NULL
  if (seenRadarrIds.length > 0) {
    await markStaleItemsRemoved(
      [notInArray(mediaItems.radarrId, seenRadarrIds), isNotNull(mediaItems.radarrId)],
      synced,
      total,
      "radarr",
      onProgress
    );
  } else if (total === 0) {
    const existing = await db
      .select({ total: count() })
      .from(mediaItems)
      .where(and(ne(mediaItems.status, "removed"), isNotNull(mediaItems.radarrId)));

    if (existing[0]?.total > 0) {
      console.warn(
        `Radarr returned 0 movies but ${existing[0].total} items exist locally. Skipping stale removal.`
      );
    }
  }

  return synced;
}

// ---------------------------------------------------------------------------
// Seerr enrichment — adds requester info to existing items
// ---------------------------------------------------------------------------

export async function enrichFromSeerr(onProgress?: ProgressCallback): Promise<number> {
  const client = await getRequestServiceClient();
  const providerLabel = await getProviderLabel();

  onProgress?.({
    phase: "seerr",
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
    phase: "seerr",
    step: `Found ${total} requests. Enriching...`,
    current: 0,
    total,
  });

  // Pre-load active media items into a lookup map to avoid N+1 queries per request.
  // Key: "tmdbId:mediaType" → value: array of matching items (may have duplicates).
  // Exclude removed items — they can't match active Seerr requests.
  const allItems = await db.select().from(mediaItems).where(ne(mediaItems.status, "removed"));
  const itemsByTmdbKey = new Map<string, (typeof allItems)[number][]>();
  for (const item of allItems) {
    if (item.tmdbId) {
      const key = `${item.tmdbId}:${item.mediaType}`;
      const existing = itemsByTmdbKey.get(key);
      if (existing) {
        existing.push(item);
      } else {
        itemsByTmdbKey.set(key, [item]);
      }
    }
  }

  let enriched = 0;
  let processed = 0;

  for (const req of requests) {
    processed++;
    const tmdbId = req.media?.tmdbId;
    const mediaType = req.type;
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

    if (!tmdbId) {
      if (processed % 5 === 0 || processed === total) {
        onProgress?.({
          phase: "seerr",
          step: "Enriching with requester info...",
          current: processed,
          total,
        });
      }
      continue;
    }

    // Find ALL matching items — there may be duplicates (legacy Overseerr + *arr item)
    const matches = itemsByTmdbKey.get(`${tmdbId}:${mediaType}`) ?? [];

    if (matches.length > 0) {
      const overseerrId = req.media?.id ?? req.id;

      // Free overseerrId from any other item that holds it — tmdbId match is the source of truth.
      // Only clear the Seerr identity fields; leave requestedByPlexId and requestedAt intact
      // to avoid permanently erasing requester history if deconfliction is a false positive.
      const matchIds = matches.map((m) => m.id);
      const cleared = await db
        .update(mediaItems)
        .set({
          overseerrId: null,
          overseerrRequestId: null,
          updatedAt: new Date().toISOString(),
        })
        .where(and(eq(mediaItems.overseerrId, overseerrId), notInArray(mediaItems.id, matchIds)))
        .returning({ id: mediaItems.id, title: mediaItems.title });

      if (cleared.length > 0) {
        debug.sync(
          `enrichFromSeerr: cleared overseerrId=${overseerrId} from ${cleared.length} conflicting item(s): ` +
            cleared.map((c) => `#${c.id} "${c.title}"`).join(", ")
        );
      }

      const seerrFields = {
        overseerrId,
        overseerrRequestId: req.id,
        requestedByPlexId,
        requestedAt: req.createdAt,
        updatedAt: new Date().toISOString(),
      };

      try {
        if (matches.length > 1) {
          // Duplicate detected — merge *arr identifiers into the legacy item and remove duplicate
          const legacyItem = matches.find((m) => m.overseerrId != null);
          const arrItem = matches.find((m) => m.sonarrId != null || m.radarrId != null);

          if (legacyItem && arrItem && legacyItem.id !== arrItem.id) {
            debug.sync(
              `enrichFromSeerr: merging duplicate for "${legacyItem.title}" tmdbId=${tmdbId} — ` +
                `legacy=#${legacyItem.id}(overseerrId=${legacyItem.overseerrId}) + ` +
                `arr=#${arrItem.id}(sonarrId=${arrItem.sonarrId},radarrId=${arrItem.radarrId})`
            );
            // Capture *arr identifiers before clearing them
            const mergeFields = {
              sonarrId: arrItem.sonarrId ?? legacyItem.sonarrId,
              radarrId: arrItem.radarrId ?? legacyItem.radarrId,
              tvdbId: arrItem.tvdbId ?? legacyItem.tvdbId,
              imdbId: arrItem.imdbId || legacyItem.imdbId,
              fileSize: arrItem.fileSize ?? legacyItem.fileSize,
              addedAt: arrItem.addedAt || legacyItem.addedAt,
              posterPath: arrItem.posterPath || legacyItem.posterPath,
              ratingKey: req.media?.ratingKey || legacyItem.ratingKey || arrItem.ratingKey || null,
            };

            // Atomic transaction: clear → merge → delete prevents phantom duplicates
            // if the process crashes mid-sequence.
            db.transaction((tx) => {
              tx.update(mediaItems)
                .set({ sonarrId: null, radarrId: null, updatedAt: new Date().toISOString() })
                .where(eq(mediaItems.id, arrItem.id))
                .run();
              tx.update(mediaItems)
                .set({ ...seerrFields, ...mergeFields })
                .where(eq(mediaItems.id, legacyItem.id))
                .run();
              try {
                tx.delete(mediaItems).where(eq(mediaItems.id, arrItem.id)).run();
              } catch {
                tx.update(mediaItems)
                  .set({ status: "removed", updatedAt: new Date().toISOString() })
                  .where(eq(mediaItems.id, arrItem.id))
                  .run();
              }
            });
            enriched++;
          } else {
            // Both items are the same type or no clear legacy/arr split — enrich the first
            const target = legacyItem || matches[0];
            await db
              .update(mediaItems)
              .set({
                ...seerrFields,
                ratingKey: req.media?.ratingKey || target.ratingKey || null,
              })
              .where(eq(mediaItems.id, target.id));
            enriched++;
          }
        } else {
          // Single match — straightforward enrichment
          await db
            .update(mediaItems)
            .set({
              ...seerrFields,
              ratingKey: req.media?.ratingKey || matches[0].ratingKey || null,
            })
            .where(eq(mediaItems.id, matches[0].id));
          enriched++;
        }
      } catch (err) {
        // Log full context and skip this item rather than aborting the entire sync
        const matchSummary = matches
          .map(
            (m) =>
              `#${m.id}(overseerrId=${m.overseerrId},sonarrId=${m.sonarrId},radarrId=${m.radarrId})`
          )
          .join(", ");
        console.error(
          `enrichFromSeerr: failed to enrich "${matches[0]?.title}" ` +
            `tmdbId=${tmdbId} overseerrId=${overseerrId} reqId=${req.id} ` +
            `matches=[${matchSummary}]: ${err instanceof Error ? err.message : err}`
        );
      }
    }
    // If no match, skip — item hasn't been downloaded/added to *arr yet

    if (processed % 5 === 0 || processed === total) {
      onProgress?.({
        phase: "seerr",
        step: "Enriching with requester info...",
        current: processed,
        total,
        detail: req.media?.tmdbId ? `TMDB: ${req.media.tmdbId}` : undefined,
      });
    }
  }

  return enriched;
}

// ---------------------------------------------------------------------------
// Legacy Overseerr sync — used when no *arr services are configured
// ---------------------------------------------------------------------------

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
          seasonCount = details.numberOfSeasons ?? null;
          // Overseerr season status: 4 = partially available, 5 = fully available
          const SEASON_AVAILABLE_THRESHOLD = 4;
          const seasons = details.mediaInfo?.seasons as
            | { seasonNumber: number; status: number }[]
            | undefined;
          if (seasons && seasons.length > 0) {
            availableSeasonCount = seasons.filter(
              (s) => s.status >= SEASON_AVAILABLE_THRESHOLD
            ).length;
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
        tmdbId: tmdbId ?? null,
        tvdbId: req.media?.tvdbId ?? null,
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
  const seenOverseerrIds = requests
    .map((r) => r.media?.id ?? r.id)
    .filter((id): id is number => id != null);

  if (seenOverseerrIds.length > 0) {
    await markStaleItemsRemoved(
      [notInArray(mediaItems.overseerrId, seenOverseerrIds), isNotNull(mediaItems.overseerrId)],
      synced,
      total,
      "overseerr",
      onProgress
    );
  } else if (total === 0) {
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

// ---------------------------------------------------------------------------
// Watch history sync (Tautulli / Tracearr) — unchanged
// ---------------------------------------------------------------------------

/**
 * Fetch TV show file sizes by querying the Plex server for all episodes
 * and aggregating by show (grandparentRatingKey).
 */
interface PlexTvSizeResult {
  /** ratingKey → aggregated file size */
  sizes: Map<string, number>;
  /** normalized title → ratingKey (for title-based matching) */
  titleToRatingKey: Map<string, string>;
}

async function fetchPlexTvFileSizes(
  client: TautulliClientType,
  sectionIds: string[]
): Promise<PlexTvSizeResult> {
  const sizes = new Map<string, number>();
  const titleToRatingKey = new Map<string, string>();

  const { pmsUrl } = await client.getServerInfo();

  const admin = await db.select().from(users).where(eq(users.isAdmin, true)).limit(1);
  const plexToken = admin[0]?.plexToken;
  if (!plexToken) return { sizes, titleToRatingKey };

  for (const sectionId of sectionIds) {
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

      // Build title → ratingKey map from episode's grandparentTitle
      if (ep.grandparentTitle) {
        const titleKey = buildTitleKey(ep.grandparentTitle);
        if (!titleToRatingKey.has(titleKey)) {
          titleToRatingKey.set(titleKey, key);
        }
      }

      for (const media of ep.Media ?? []) {
        for (const part of media.Part ?? []) {
          if (part.size && Number(part.size) > 0) {
            sizes.set(key, (sizes.get(key) || 0) + Number(part.size));
          }
        }
      }
    }
  }

  return { sizes, titleToRatingKey };
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

  // Resolve missing ratingKeys for *arr-sourced items by matching Tautulli library titles
  onProgress?.({
    phase: "tautulli",
    step: "Resolving rating keys for library items...",
    current: 0,
    total: 0,
  });

  const missingRatingKey = await db
    .select()
    .from(mediaItems)
    .where(
      and(
        sql`${mediaItems.ratingKey} IS NULL`,
        ne(mediaItems.status, "removed"),
        sql`(${mediaItems.sonarrId} IS NOT NULL OR ${mediaItems.radarrId} IS NOT NULL)`
      )
    );

  if (missingRatingKey.length > 0) {
    try {
      const libraries = await client.getLibraries();
      // Build a title-keyed map from Tautulli library items
      const tautulliRatingKeys = new Map<string, string>();

      for (const lib of libraries) {
        const sectionId = String(lib.section_id);
        const libItems = await client.getLibraryMediaInfo(sectionId);
        for (const li of libItems) {
          if (li.rating_key && li.title) {
            const rk = String(li.rating_key);
            // Store with year for precise matching
            if (li.year) {
              tautulliRatingKeys.set(buildTitleKey(li.title, Number(li.year)), rk);
            }
            // Always store title-only key as fallback (DB items don't have year)
            if (!tautulliRatingKeys.has(buildTitleKey(li.title))) {
              tautulliRatingKeys.set(buildTitleKey(li.title), rk);
            }
          }
        }
      }

      let resolved = 0;
      const now = new Date().toISOString();
      for (const item of missingRatingKey) {
        const key = buildTitleKey(item.title);
        const rk = tautulliRatingKeys.get(key);
        if (rk) {
          await db
            .update(mediaItems)
            .set({ ratingKey: rk, updatedAt: now })
            .where(eq(mediaItems.id, item.id));
          resolved++;
        }
      }

      if (resolved > 0) {
        onProgress?.({
          phase: "tautulli",
          step: `Resolved ${resolved} rating keys from Tautulli libraries`,
          current: 0,
          total: 0,
        });
      }
    } catch (err) {
      console.error("Failed to resolve missing rating keys:", err);
    }
  }

  onProgress?.({
    phase: "tautulli",
    step: "Fetching media items with rating keys...",
    current: 0,
    total: 0,
  });

  const items = await db.select().from(mediaItems).where(isNotNull(mediaItems.ratingKey));

  const total = items.length;
  onProgress?.({
    phase: "tautulli",
    step: `Found ${total} items with rating keys. Fetching watch history...`,
    current: 0,
    total,
  });

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

      const byUser = new Map<
        string,
        { watched: boolean; playCount: number; lastWatchedAt: string | null }
      >();

      for (const record of history) {
        if (!record.user_id) continue;

        const tautulliUser = tautulliUsers.find((u) => u.user_id === record.user_id);
        if (!tautulliUser) continue;

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

  // Also update file sizes — standalone Tautulli sync should include this
  // (runFullSync calls it as Layer 4, but users triggering "Tautulli Only"
  // expect file sizes to be updated too).
  await syncMissingFileSizes(onProgress);

  return synced;
}

/**
 * Build a title-based lookup key for matching Tracearr sessions to local media items.
 */
function buildTitleKey(title: string, year?: number | null): string {
  const normalized = title
    .trim()
    .toLowerCase()
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'") // curly single quotes → straight
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"'); // curly double quotes → straight
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

  type WatchAgg = { watched: boolean; playCount: number; lastWatchedAt: string | null };
  const watchMap = new Map<string, Map<string, WatchAgg>>();

  for (const session of allSessions) {
    const matchTitle =
      session.mediaType === "episode" && session.showTitle ? session.showTitle : session.mediaTitle;
    if (!matchTitle) continue;

    // Don't include year — media items don't store year so keys must match without it
    const titleKey = buildTitleKey(matchTitle);
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

  const items = await db.select().from(mediaItems);

  const total = items.length;
  let processed = 0;

  onProgress?.({
    phase: "tracearr",
    step: `Matching ${watchMap.size} watched titles against ${total} media items...`,
    current: 0,
    total,
  });

  const allUsers = await db.select().from(users);
  const usersByUsername = new Map<string, string>();
  for (const u of allUsers) {
    usersByUsername.set(u.username, u.plexId);
  }

  const allWatchStatus = await db.select().from(watchStatus);
  const watchStatusMap = new Map<string, (typeof allWatchStatus)[number]>();
  for (const ws of allWatchStatus) {
    watchStatusMap.set(`${ws.mediaItemId}:${ws.userPlexId}`, ws);
  }

  for (const item of items) {
    processed++;

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

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// File size gap-fill — runs after all provider syncs to fill in missing sizes
// ---------------------------------------------------------------------------

export async function syncMissingFileSizes(onProgress?: ProgressCallback): Promise<void> {
  const allItems = await db
    .select({
      id: mediaItems.id,
      title: mediaItems.title,
      mediaType: mediaItems.mediaType,
      ratingKey: mediaItems.ratingKey,
      fileSize: mediaItems.fileSize,
    })
    .from(mediaItems)
    .where(ne(mediaItems.status, "removed"));

  const itemsMissingSize = allItems.filter((i) => !i.fileSize);
  if (itemsMissingSize.length === 0) {
    debug.sync("[file-sizes] All items already have file sizes");
    return;
  }

  const withRk = itemsMissingSize.filter((i) => i.ratingKey);
  const withoutRk = itemsMissingSize.filter((i) => !i.ratingKey);
  debug.sync(
    `[file-sizes] ${itemsMissingSize.length} items missing size ` +
      `(${withRk.length} have ratingKey, ${withoutRk.length} need title match)`
  );

  if (withoutRk.length > 0) {
    debug.sync(
      "[file-sizes] Items without ratingKey:",
      withoutRk.map((i) => `"${i.title}" (${i.mediaType}, id=${i.id})`).join(", ")
    );
  }

  // Tautulli is required for library metadata and Plex server info
  const tautulliConfig = await getServiceConfig("tautulli");
  if (!tautulliConfig) {
    debug.sync("[file-sizes] Tautulli not configured, skipping");
    return;
  }

  const client = createTautulliClient(tautulliConfig);

  try {
    onProgress?.({
      phase: "tautulli",
      step: `Syncing file sizes for ${itemsMissingSize.length} items...`,
      current: 0,
      total: itemsMissingSize.length,
    });

    // ratingKey → fileSize
    const fileSizeMap = new Map<string, number>();
    // title (lowercase) → { ratingKey, fileSize } for items without ratingKeys
    const titleSizeMap = new Map<string, { ratingKey: string; fileSize: number }>();

    const libraries = await client.getLibraries();
    debug.sync(
      `[file-sizes] Tautulli libraries: ${libraries.map((l) => `${l.section_name} (${l.section_type}, id=${l.section_id})`).join(", ")}`
    );

    let tautulliItemCount = 0;
    let tautulliWithSize = 0;
    for (const lib of libraries) {
      const sectionId = String(lib.section_id);
      const mediaInfo = await client.getLibraryMediaInfo(sectionId);
      debug.sync(
        `[file-sizes] Library "${lib.section_name}": ${mediaInfo.length} items from Tautulli`
      );
      for (const item of mediaInfo) {
        if (!item.rating_key) continue;
        tautulliItemCount++;
        const rk = String(item.rating_key);

        if (item.file_size) {
          const size = Number(item.file_size);
          if (size > 0) {
            fileSizeMap.set(rk, (fileSizeMap.get(rk) || 0) + size);
            tautulliWithSize++;
          }
        }

        // Build title lookup for items missing ratingKeys
        if (item.title) {
          const titleKey = item.title.trim().toLowerCase();
          if (!titleSizeMap.has(titleKey)) {
            titleSizeMap.set(titleKey, {
              ratingKey: rk,
              fileSize: fileSizeMap.get(rk) || 0,
            });
          }
        }
      }
    }
    debug.sync(
      `[file-sizes] Tautulli totals: ${tautulliItemCount} items with ratingKey, ${tautulliWithSize} with file size, ${titleSizeMap.size} unique titles`
    );

    // Update titleSizeMap entries now that fileSizeMap is fully built
    for (const [titleKey, entry] of titleSizeMap) {
      const updatedSize = fileSizeMap.get(entry.ratingKey);
      if (updatedSize !== undefined && updatedSize > entry.fileSize) {
        titleSizeMap.set(titleKey, { ratingKey: entry.ratingKey, fileSize: updatedSize });
      }
    }

    // Normalize quotes/apostrophes for matching: curly → straight
    function normalizeQuotes(s: string): string {
      return s
        .replace(/[\u2018\u2019\u201A\u201B]/g, "'") // curly single quotes → straight
        .replace(/[\u201C\u201D\u201E\u201F]/g, '"'); // curly double quotes → straight
    }

    // Build a normalized lookup: normalizeQuotes(title) → same entry
    const normalizedTitleMap = new Map<string, { ratingKey: string; fileSize: number }>();
    for (const [key, entry] of titleSizeMap) {
      const nk = normalizeQuotes(key);
      if (nk !== key && !normalizedTitleMap.has(nk)) {
        normalizedTitleMap.set(nk, entry);
      }
    }

    // Try to find a title match: exact → quote-normalized → stripped parenthetical
    function findTitleMatch(title: string) {
      const exactKey = title.trim().toLowerCase();

      // 1. Exact match
      const exact = titleSizeMap.get(exactKey);
      if (exact) return { match: exact, via: "exact" };

      // 2. Quote-normalized match (curly vs straight apostrophes)
      const normalized = normalizeQuotes(exactKey);
      if (normalized !== exactKey) {
        const normMatch = titleSizeMap.get(normalized);
        if (normMatch) return { match: normMatch, via: "quote-normalized" };
      }
      // Also check if Tautulli had curly quotes and DB has straight
      const fromNormMap = normalizedTitleMap.get(normalizeQuotes(exactKey));
      if (fromNormMap) return { match: fromNormMap, via: "quote-normalized" };

      // 3. Strip trailing parenthetical like (2017), (UK), (AU)
      const stripped = normalizeQuotes(exactKey)
        .replace(/\s*\([^)]+\)\s*$/, "")
        .trim();
      if (stripped !== normalizeQuotes(exactKey)) {
        const fuzzy = titleSizeMap.get(stripped) || normalizedTitleMap.get(stripped);
        if (fuzzy) return { match: fuzzy, via: `fuzzy: "${stripped}"` };
      }

      return null;
    }

    // Check if any items are still missing sizes (by ratingKey or title match)
    const hasMissing = itemsMissingSize.some((i) => {
      if (i.ratingKey) return !fileSizeMap.has(i.ratingKey);
      const result = findTitleMatch(i.title);
      return result ? !fileSizeMap.has(result.match.ratingKey) : false;
    });

    debug.sync(`[file-sizes] Items still missing after Tautulli: hasMissing=${hasMissing}`);

    // Check for items that still need Plex fallback:
    // - items with ratingKey but no size in fileSizeMap
    // - items without ratingKey that didn't match any Tautulli title
    const needsPlexFallback = hasMissing || withoutRk.some((i) => !findTitleMatch(i.title));

    if (needsPlexFallback) {
      const sectionsToFetch = libraries
        .filter((l) => l.section_type === "show")
        .map((l) => String(l.section_id));

      if (sectionsToFetch.length > 0) {
        debug.sync(
          `[file-sizes] Fetching Plex episode data for ${sectionsToFetch.length} TV sections`
        );
        const plexResult = await fetchPlexTvFileSizes(client, sectionsToFetch);
        debug.sync(
          `[file-sizes] Plex returned ${plexResult.sizes.size} show sizes, ${plexResult.titleToRatingKey.size} title mappings`
        );
        for (const [rk, size] of plexResult.sizes) {
          if (!fileSizeMap.has(rk)) {
            fileSizeMap.set(rk, size);
          }
        }
        // Merge Plex title→ratingKey into titleSizeMap for items Tautulli missed
        for (const [titleKey, rk] of plexResult.titleToRatingKey) {
          if (!titleSizeMap.has(titleKey)) {
            const size = fileSizeMap.get(rk) || 0;
            titleSizeMap.set(titleKey, { ratingKey: rk, fileSize: size });
          }
        }
      }
    }

    let updatedByRk = 0;
    let updatedByTitle = 0;
    const unmatched: string[] = [];
    const now = new Date().toISOString();
    for (const item of itemsMissingSize) {
      if (item.ratingKey) {
        // Match by ratingKey
        const size = fileSizeMap.get(item.ratingKey);
        if (size !== undefined) {
          await db
            .update(mediaItems)
            .set({ fileSize: size, updatedAt: now })
            .where(eq(mediaItems.id, item.id));
          updatedByRk++;
        } else {
          unmatched.push(`"${item.title}" (rk=${item.ratingKey}, ${item.mediaType})`);
        }
      } else {
        // No ratingKey — try title-based matching to set both ratingKey and fileSize
        const result = findTitleMatch(item.title);
        if (result) {
          const { match } = result;
          const size = fileSizeMap.get(match.ratingKey) || match.fileSize;
          const updates: Record<string, unknown> = {
            ratingKey: match.ratingKey,
            updatedAt: now,
          };
          if (size > 0) {
            updates.fileSize = size;
          }
          await db.update(mediaItems).set(updates).where(eq(mediaItems.id, item.id));
          updatedByTitle++;
          debug.sync(
            `[file-sizes] Title match: "${item.title}" → rk=${match.ratingKey} (${result.via})`
          );
        } else {
          // Log near-misses: find Tautulli titles that start with the same prefix
          const prefix = item.title.trim().toLowerCase().split(/[:(]/)[0].trim();
          const nearMatches: string[] = [];
          for (const [tKey] of titleSizeMap) {
            if (tKey.startsWith(prefix) || prefix.startsWith(tKey)) {
              nearMatches.push(tKey);
            }
          }
          const nearInfo =
            nearMatches.length > 0
              ? ` — near: [${nearMatches.join(", ")}]`
              : " — no near matches in Tautulli";
          unmatched.push(`"${item.title}" (no ratingKey, ${item.mediaType})${nearInfo}`);
        }
      }
    }

    const totalUpdated = updatedByRk + updatedByTitle;
    debug.sync(
      `[file-sizes] Updated ${totalUpdated} items ` +
        `(${updatedByRk} by ratingKey, ${updatedByTitle} by title match)`
    );
    if (unmatched.length > 0) {
      debug.sync(`[file-sizes] ${unmatched.length} items still unmatched: ${unmatched.join(", ")}`);
    }

    onProgress?.({
      phase: "tautulli",
      step: `Updated file sizes for ${totalUpdated} items`,
      current: itemsMissingSize.length,
      total: itemsMissingSize.length,
    });
  } catch (err) {
    console.error("Failed to sync file sizes:", err);
  }
}

// ---------------------------------------------------------------------------
// Full sync orchestrator
// ---------------------------------------------------------------------------

export type FullSyncResult = {
  sonarr?: number;
  radarr?: number;
  seerr?: number;
  overseerr?: number;
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
    const result: FullSyncResult = {};

    // Auto-detect: if *arr services are configured, use them as primary source
    const sonarrConfig = await getServiceConfig("sonarr");
    const radarrConfig = await getServiceConfig("radarr");
    const hasArrSource = sonarrConfig !== null || radarrConfig !== null;

    if (hasArrSource) {
      // Layer 1: *arr services as primary content source
      if (sonarrConfig) {
        result.sonarr = await syncSonarr(onProgress);
      }
      if (radarrConfig) {
        result.radarr = await syncRadarr(onProgress);
      }

      // Layer 2: Seerr enrichment (optional)
      try {
        await getActiveProvider();
        result.seerr = await enrichFromSeerr(onProgress);
      } catch {
        // No Seerr configured — that's fine, it's optional
      }
    } else {
      // Legacy mode: Seerr as primary content source (backward compatible)
      result.overseerr = await syncOverseerr(onProgress);
    }

    // Layer 3: Watch history (Tautulli/Tracearr)
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

    try {
      const statsCount = await syncWatchHistory(onProgress);
      result[resolvedStatsProvider] = statsCount;
    } catch {
      // No stats provider configured — that's fine for full sync
    }

    // Layer 4: Fill in missing file sizes via Tautulli/Plex (if Tautulli is available)
    await syncMissingFileSizes(onProgress);

    const totalSynced = Object.values(result).reduce((sum, n) => sum + (n || 0), 0);
    await db
      .update(syncLog)
      .set({
        status: "completed",
        itemsSynced: totalSynced,
        completedAt: new Date().toISOString(),
      })
      .where(eq(syncLog.id, logId));

    return result;
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
