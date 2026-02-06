import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { mediaItems, userVotes, users, syncLog } from "@/lib/db/schema";
import { eq, count, desc, sql } from "drizzle-orm";
import { SyncStatus } from "@/components/admin/SyncStatus";
import { DeletionCandidates } from "@/components/admin/DeletionCandidates";

export default async function AdminPage() {
  const session = await getSession();
  if (!session?.isAdmin) redirect("/");

  // Get overview stats
  const [totalMedia] = await db.select({ total: count() }).from(mediaItems);
  const [totalUsers] = await db.select({ total: count() }).from(users);
  const [totalDeleteVotes] = await db
    .select({ total: count() })
    .from(userVotes)
    .where(eq(userVotes.vote, "delete"));
  const [totalKeepVotes] = await db
    .select({ total: count() })
    .from(userVotes)
    .where(eq(userVotes.vote, "keep"));

  // Get last sync
  const lastSyncResult = await db
    .select()
    .from(syncLog)
    .orderBy(desc(syncLog.startedAt))
    .limit(1);

  const lastSync = lastSyncResult[0] || null;

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
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Plex Sync - Admin</h1>
            <p className="text-sm text-gray-400">Library management overview</p>
          </div>
          <div className="flex items-center gap-4">
            <a href="/dashboard" className="text-sm text-gray-400 hover:text-gray-200">
              Dashboard
            </a>
            <form action="/api/auth/logout" method="POST">
              <button className="text-sm text-gray-400 hover:text-gray-200">
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Overview Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total Media</p>
            <p className="text-2xl font-bold mt-1">{totalMedia?.total || 0}</p>
          </div>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Users</p>
            <p className="text-2xl font-bold mt-1">{totalUsers?.total || 0}</p>
          </div>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Keep Votes</p>
            <p className="text-2xl font-bold mt-1 text-green-400">{totalKeepVotes?.total || 0}</p>
          </div>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Delete Votes</p>
            <p className="text-2xl font-bold mt-1 text-red-400">{totalDeleteVotes?.total || 0}</p>
          </div>
        </div>

        {/* Sync */}
        <SyncStatus lastSync={lastSync} />

        {/* Users breakdown */}
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h3 className="text-lg font-semibold mb-4">Users</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-800">
                  <th className="pb-3 pr-4">Username</th>
                  <th className="pb-3">Requests</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {userStats.map((u) => (
                  <tr key={u.plexId} className="text-gray-200">
                    <td className="py-3 pr-4">{u.username}</td>
                    <td className="py-3">{u.requestCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Deletion Candidates */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Deletion Candidates</h2>
          <DeletionCandidates />
        </div>
      </main>
    </div>
  );
}
