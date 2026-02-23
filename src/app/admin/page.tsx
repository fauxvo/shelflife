import Link from "next/link";
import { db } from "@/lib/db";
import { mediaItems, userVotes, users } from "@/lib/db/schema";
import { count, desc, inArray, sql } from "drizzle-orm";

export default async function AdminPage() {
  const [totalMedia] = await db.select({ total: count() }).from(mediaItems);
  const [totalUsers] = await db.select({ total: count() }).from(users);
  const [totalNominations] = await db
    .select({ total: count() })
    .from(userVotes)
    .where(inArray(userVotes.vote, ["delete", "trim"]));

  const userStats = await db
    .select({
      username: users.username,
      plexId: users.plexId,
      totalRequests: count(mediaItems.id),
      activeRequests: sql<number>`count(case when ${mediaItems.status} != 'removed' then 1 end)`,
    })
    .from(users)
    .leftJoin(mediaItems, sql`${mediaItems.requestedByPlexId} = ${users.plexId}`)
    .groupBy(users.id)
    .orderBy(desc(count(mediaItems.id)));

  return (
    <>
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

      {/* Quick user breakdown */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
        <h3 className="mb-4 text-lg font-semibold">Users</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-gray-400">
                <th className="pr-4 pb-3">Username</th>
                <th className="pr-4 pb-3">Active</th>
                <th className="pb-3">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {userStats.map((u) => (
                <tr key={u.plexId} className="text-gray-200">
                  <td className="py-3 pr-4">
                    <Link href={`/admin/users/${u.plexId}`} className="text-brand hover:underline">
                      {u.username}
                    </Link>
                  </td>
                  <td className="py-3 pr-4">{u.activeRequests}</td>
                  <td className="py-3 text-gray-500">{u.totalRequests}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
