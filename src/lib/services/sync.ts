import { db } from "@/lib/db";
import { mediaItems, watchStatus, syncLog, users } from "@/lib/db/schema";
import { getOverseerrClient, mapMediaStatus } from "./overseerr";
import { getTautulliClient } from "./tautulli";
import { eq, sql } from "drizzle-orm";

export async function syncOverseerr(): Promise<number> {
  const client = getOverseerrClient();
  const requests = await client.getAllRequests();
  let synced = 0;

  for (const req of requests) {
    const tmdbId = req.media?.tmdbId;
    const mediaType = req.type;

    let title = `Unknown (TMDB: ${tmdbId})`;
    let posterPath: string | null = null;

    // Try to fetch title from Overseerr
    if (tmdbId) {
      try {
        const details = await client.getMediaDetails(tmdbId, mediaType);
        title = details.title || details.name || details.originalTitle || details.originalName || title;
        posterPath = details.posterPath || null;
      } catch {
        // Keep default title if fetch fails
      }
    }

    const requestedByPlexId = req.requestedBy?.plexId
      ? String(req.requestedBy.plexId)
      : null;

    // Upsert the requesting user if we have their info
    if (requestedByPlexId && req.requestedBy) {
      await db
        .insert(users)
        .values({
          plexId: requestedByPlexId,
          username:
            req.requestedBy.plexUsername ||
            req.requestedBy.username ||
            req.requestedBy.email ||
            "Unknown",
          email: req.requestedBy.email || null,
          avatarUrl: req.requestedBy.avatar || null,
        })
        .onConflictDoUpdate({
          target: users.plexId,
          set: {
            username:
              req.requestedBy.plexUsername ||
              req.requestedBy.username ||
              req.requestedBy.email ||
              "Unknown",
            email: req.requestedBy.email || null,
            avatarUrl: req.requestedBy.avatar || null,
            updatedAt: sql`datetime('now')`,
          },
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
        mediaType,
        title,
        posterPath,
        status: mapMediaStatus(req.media?.status),
        requestedByPlexId,
        requestedAt: req.createdAt,
        ratingKey: req.media?.ratingKey || null,
        lastSyncedAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: mediaItems.overseerrId,
        set: {
          title,
          posterPath,
          status: mapMediaStatus(req.media?.status),
          ratingKey: req.media?.ratingKey || null,
          lastSyncedAt: new Date().toISOString(),
          updatedAt: sql`datetime('now')`,
        },
      });

    synced++;
  }

  return synced;
}

export async function syncTautulli(): Promise<number> {
  const client = getTautulliClient();
  let synced = 0;

  // Get all media items that have a rating key
  const items = await db
    .select()
    .from(mediaItems)
    .where(sql`${mediaItems.ratingKey} IS NOT NULL`);

  // Get all Tautulli users to map user_id -> plex_id
  const tautulliUsers = await client.getUsers();
  const userIdToPlexId = new Map<number, string>();
  for (const u of tautulliUsers) {
    // Tautulli user_id is not the same as plexId - we need to match them
    // The best we can do is match by username or store the mapping
    userIdToPlexId.set(u.user_id, String(u.user_id));
  }

  for (const item of items) {
    if (!item.ratingKey) continue;

    try {
      const history = await client.getHistory(item.ratingKey);

      for (const record of history) {
        if (!record.user_id) continue;

        // Try to find the user by their Tautulli user_id
        // We'll match against existing users by username if possible
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

        // Upsert watch status
        const existing = await db
          .select()
          .from(watchStatus)
          .where(
            sql`${watchStatus.mediaItemId} = ${item.id} AND ${watchStatus.userPlexId} = ${userPlexId}`
          )
          .limit(1);

        const watched = record.watched_status === 1;
        const lastWatchedAt = record.stopped
          ? new Date(record.stopped * 1000).toISOString()
          : null;

        if (existing.length > 0) {
          await db
            .update(watchStatus)
            .set({
              watched: watched || existing[0].watched,
              playCount: existing[0].playCount + 1,
              lastWatchedAt: lastWatchedAt || existing[0].lastWatchedAt,
              syncedAt: new Date().toISOString(),
            })
            .where(eq(watchStatus.id, existing[0].id));
        } else {
          await db.insert(watchStatus).values({
            mediaItemId: item.id,
            userPlexId,
            watched,
            playCount: 1,
            lastWatchedAt,
          });
        }

        synced++;
      }
    } catch (err) {
      console.error(`Failed to sync watch status for ${item.title}:`, err);
    }
  }

  return synced;
}

export async function runFullSync(): Promise<{ overseerr: number; tautulli: number }> {
  const logEntry = await db
    .insert(syncLog)
    .values({
      syncType: "full",
      status: "running",
    })
    .returning();

  const logId = logEntry[0].id;

  try {
    const overseerrCount = await syncOverseerr();
    const tautulliCount = await syncTautulli();

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
