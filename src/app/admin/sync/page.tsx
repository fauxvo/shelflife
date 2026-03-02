import { db } from "@/lib/db";
import { syncLog } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { SyncStatus } from "@/components/admin/SyncStatus";
import { AutoSyncSettings } from "@/components/admin/AutoSyncSettings";
import { getSyncScheduleSettings } from "@/lib/services/settings";

export default async function AdminSyncPage() {
  const lastSyncResult = await db.select().from(syncLog).orderBy(desc(syncLog.startedAt)).limit(1);

  const lastSync = lastSyncResult[0] || null;
  const syncScheduleSettings = await getSyncScheduleSettings();

  return (
    <>
      <SyncStatus lastSync={lastSync} />
      <AutoSyncSettings initialSettings={syncScheduleSettings} />
    </>
  );
}
