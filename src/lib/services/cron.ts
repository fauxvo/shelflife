import cron, { type ScheduledTask } from "node-cron";
import { dispatchSync, isSyncInProgress } from "@/lib/services/sync-dispatch";
import { getSyncScheduleSettings } from "@/lib/services/settings";
import { debug, log } from "@/lib/debug";

// Module-level state — valid because Shelflife runs as a single long-lived
// Node.js process (Docker/self-hosted). Not suitable for serverless or
// multi-instance deployments where each instance would run its own scheduler.
let scheduledTask: ScheduledTask | null = null;
let rescheduling: Promise<void> | null = null;

async function executeSyncJob(syncType: string) {
  if (isSyncInProgress()) {
    debug.cron("Sync already in progress, skipping scheduled run");
    return;
  }

  debug.cron(`Starting scheduled ${syncType} sync`);

  try {
    const result = await dispatchSync(syncType);
    debug.cron("Scheduled sync completed:", result);
  } catch (err) {
    log.error("cron", "Scheduled sync failed:", err);
  }
}

async function doReschedule(): Promise<void> {
  // Stop existing task
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }

  const settings = await getSyncScheduleSettings();

  if (!settings.enabled) {
    debug.cron("Auto-sync is disabled");
    return;
  }

  if (!cron.validate(settings.schedule)) {
    log.warn("cron", `Invalid cron expression: ${settings.schedule}`);
    return;
  }

  scheduledTask = cron.schedule(settings.schedule, () => {
    executeSyncJob(settings.syncType);
  });

  debug.cron(`Scheduled ${settings.syncType} sync: ${settings.schedule}`);
}

// Serialized reschedule — prevents concurrent calls from leaking tasks
export function rescheduleSync(): Promise<void> {
  rescheduling = (rescheduling ?? Promise.resolve()).then(doReschedule);
  return rescheduling;
}

export async function initCronScheduler(): Promise<void> {
  debug.cron("Initializing cron scheduler");
  await rescheduleSync();
}
