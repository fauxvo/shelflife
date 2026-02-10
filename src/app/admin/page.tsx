import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { mediaItems, userVotes, users, syncLog } from "@/lib/db/schema";
import { eq, count, desc, inArray } from "drizzle-orm";
import { SyncStatus } from "@/components/admin/SyncStatus";
import { AutoSyncSettings } from "@/components/admin/AutoSyncSettings";
import { ReviewRoundList } from "@/components/admin/ReviewRoundList";
import { AppVersion } from "@/components/ui/AppVersion";
import { getSyncScheduleSettings } from "@/lib/services/settings";

export default async function AdminPage() {
  const session = await getSession();
  if (!session?.isAdmin) redirect("/");

  // Get overview stats
  const [totalMedia] = await db.select({ total: count() }).from(mediaItems);
  const [totalUsers] = await db.select({ total: count() }).from(users);
  const [totalNominations] = await db
    .select({ total: count() })
    .from(userVotes)
    .where(inArray(userVotes.vote, ["delete", "trim"]));

  // Get last sync
  const lastSyncResult = await db.select().from(syncLog).orderBy(desc(syncLog.startedAt)).limit(1);

  const lastSync = lastSyncResult[0] || null;

  // Sync schedule settings
  const syncScheduleSettings = await getSyncScheduleSettings();

  // Per-user stats
  const userStats = await db
    .select({
      username: users.username,
      plexId: users.plexId,
      requestCount: count(mediaItems.id),
    })
    .from(users)
    .leftJoin(mediaItems, eq(mediaItems.requestedByPlexId, users.plexId))
    .groupBy(users.id)
    .orderBy(desc(count(mediaItems.id)));

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div>
            <div className="flex items-baseline gap-2">
              <h1 className="text-xl font-bold">Shelflife - Admin</h1>
              <AppVersion />
            </div>
            <p className="text-sm text-gray-400">Library management overview</p>
          </div>
          <div className="flex items-center gap-4">
            <a href="/dashboard" className="text-sm text-gray-400 hover:text-gray-200">
              Dashboard
            </a>
            <a href="/community" className="text-sm text-gray-400 hover:text-gray-200">
              Community
            </a>
            <form action="/api/auth/logout" method="POST">
              <button className="text-sm text-gray-400 hover:text-gray-200">Sign Out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8">
        {/* Overview Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
            <p className="text-xs tracking-wide text-gray-500 uppercase">Total Media</p>
            <p className="mt-1 text-2xl font-bold">{totalMedia?.total || 0}</p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
            <p className="text-xs tracking-wide text-gray-500 uppercase">Users</p>
            <p className="mt-1 text-2xl font-bold">{totalUsers?.total || 0}</p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
            <p className="text-xs tracking-wide text-gray-500 uppercase">Nominations</p>
            <p className="mt-1 text-2xl font-bold text-red-400">{totalNominations?.total || 0}</p>
          </div>
        </div>

        {/* Sync */}
        <SyncStatus lastSync={lastSync} />

        {/* Auto Sync */}
        <AutoSyncSettings initialSettings={syncScheduleSettings} />

        {/* Users breakdown */}
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
          <h3 className="mb-4 text-lg font-semibold">Users</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left text-gray-400">
                  <th className="pr-4 pb-3">Username</th>
                  <th className="pb-3">Requests</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {userStats.map((u) => (
                  <tr key={u.plexId} className="text-gray-200">
                    <td className="py-3 pr-4">
                      <a
                        href={`/admin/users/${u.plexId}`}
                        className="text-[#e5a00d] hover:underline"
                      >
                        {u.username}
                      </a>
                    </td>
                    <td className="py-3">{u.requestCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Review Rounds */}
        <div>
          <h2 className="mb-4 text-lg font-semibold">Review Rounds</h2>
          <ReviewRoundList />
        </div>
      </main>
    </div>
  );
}
