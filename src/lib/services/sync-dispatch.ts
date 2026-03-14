import { db } from "@/lib/db";
import { syncLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  runFullSync,
  syncOverseerr,
  syncTautulli,
  syncTracearr,
  syncSonarr,
  syncRadarr,
  enrichFromSeerr,
} from "./sync";
import type { SyncProgress } from "./sync";

// In-process lock — valid because Shelflife runs as a single long-lived Node.js
// process with SQLite (which is single-process by design). Not suitable for
// serverless or multi-instance deployments.
let isSyncing = false;

export function isSyncInProgress(): boolean {
  return isSyncing;
}

/**
 * Wraps a single-provider sync function with sync_log bookkeeping.
 * Creates a log entry, runs the sync, updates the log on success/failure.
 */
async function runWithSyncLog(
  syncType: "overseerr" | "tautulli" | "tracearr" | "sonarr" | "radarr" | "seerr",
  syncFn: (onProgress?: (progress: SyncProgress) => void) => Promise<number>,
  onProgress?: (progress: SyncProgress) => void
): Promise<Record<string, number>> {
  const logEntry = await db.insert(syncLog).values({ syncType, status: "running" }).returning();
  const logId = logEntry[0].id;
  try {
    const count = await syncFn(onProgress);
    await db
      .update(syncLog)
      .set({
        status: "completed",
        itemsSynced: count,
        completedAt: new Date().toISOString(),
      })
      .where(eq(syncLog.id, logId));
    return { [syncType]: count };
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

export async function dispatchSync(type: string, onProgress?: (progress: SyncProgress) => void) {
  if (isSyncing) {
    throw new Error("A sync is already in progress");
  }

  isSyncing = true;
  try {
    switch (type) {
      case "sonarr":
        return await runWithSyncLog("sonarr", syncSonarr, onProgress);
      case "radarr":
        return await runWithSyncLog("radarr", syncRadarr, onProgress);
      case "seerr":
        return await runWithSyncLog("seerr", enrichFromSeerr, onProgress);
      case "overseerr":
        return await runWithSyncLog("overseerr", syncOverseerr, onProgress);
      case "tautulli":
        return await runWithSyncLog("tautulli", syncTautulli, onProgress);
      case "tracearr":
        return await runWithSyncLog("tracearr", syncTracearr, onProgress);
      default: {
        // runFullSync handles its own sync_log writing
        return await runFullSync(onProgress);
      }
    }
  } finally {
    isSyncing = false;
  }
}
