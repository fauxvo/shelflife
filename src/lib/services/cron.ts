import cron, { type ScheduledTask } from "node-cron";
import { dispatchSync, isSyncInProgress } from "@/lib/services/sync-dispatch";
import { getSyncScheduleSettings } from "@/lib/services/settings";

let scheduledTask: ScheduledTask | null = null;
let rescheduling: Promise<void> | null = null;

async function executeSyncJob(syncType: string) {
  if (isSyncInProgress()) {
    console.log("[cron] Sync already in progress, skipping scheduled run");
    return;
  }

  console.log(`[cron] Starting scheduled ${syncType} sync`);

  try {
    const result = await dispatchSync(syncType);
    console.log("[cron] Scheduled sync completed:", result);
  } catch (err) {
    console.error("[cron] Scheduled sync failed:", err);
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
    console.log("[cron] Auto-sync is disabled");
    return;
  }

  if (!cron.validate(settings.schedule)) {
    console.error(`[cron] Invalid cron expression: ${settings.schedule}`);
    return;
  }

  scheduledTask = cron.schedule(settings.schedule, () => {
    executeSyncJob(settings.syncType);
  });

  console.log(`[cron] Scheduled ${settings.syncType} sync: ${settings.schedule}`);
}

// Serialized reschedule — prevents concurrent calls from leaking tasks
export function rescheduleSync(): Promise<void> {
  rescheduling = (rescheduling ?? Promise.resolve()).then(doReschedule);
  return rescheduling;
}

export async function initCronScheduler(): Promise<void> {
  console.log("[cron] Initializing cron scheduler");
  await rescheduleSync();
}
