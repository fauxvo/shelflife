import { db } from "@/lib/db";
import { syncLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { runFullSync, syncOverseerr, syncTautulli } from "./sync";
import type { SyncProgress } from "./sync";

// In-process lock — valid because Shelflife runs as a single long-lived Node.js
// process with SQLite (which is single-process by design). Not suitable for
// serverless or multi-instance deployments.
let isSyncing = false;

export function isSyncInProgress(): boolean {
  return isSyncing;
}

export async function dispatchSync(type: string, onProgress?: (progress: SyncProgress) => void) {
  if (isSyncing) {
    throw new Error("A sync is already in progress");
  }

  isSyncing = true;
  try {
    switch (type) {
      case "overseerr": {
        const logEntry = await db
          .insert(syncLog)
          .values({ syncType: "overseerr", status: "running" })
          .returning();
        const logId = logEntry[0].id;
        try {
          const count = await syncOverseerr(onProgress);
          await db
            .update(syncLog)
            .set({
              status: "completed",
              itemsSynced: count,
              completedAt: new Date().toISOString(),
            })
            .where(eq(syncLog.id, logId));
          return { overseerr: count };
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
      case "tautulli": {
        const logEntry = await db
          .insert(syncLog)
          .values({ syncType: "tautulli", status: "running" })
          .returning();
        const logId = logEntry[0].id;
        try {
          const count = await syncTautulli(onProgress);
          await db
            .update(syncLog)
            .set({
              status: "completed",
              itemsSynced: count,
              completedAt: new Date().toISOString(),
            })
            .where(eq(syncLog.id, logId));
          return { tautulli: count };
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
      default: {
        // runFullSync handles its own sync_log writing
        return await runFullSync(onProgress);
      }
    }
  } finally {
    isSyncing = false;
  }
}
