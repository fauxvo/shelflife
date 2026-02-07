import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { mediaItems, userVotes, watchStatus } from "@/lib/db/schema";
import { eq, and, count } from "drizzle-orm";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { AppVersion } from "@/components/ui/AppVersion";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/");

  // Get stats for this user
  const [totalResult] = await db
    .select({ total: count() })
    .from(mediaItems)
    .where(eq(mediaItems.requestedByPlexId, session.plexId));

  const [keepResult] = await db
    .select({ total: count() })
    .from(userVotes)
    .where(and(eq(userVotes.userPlexId, session.plexId), eq(userVotes.vote, "keep")));

  const [deleteResult] = await db
    .select({ total: count() })
    .from(userVotes)
    .where(and(eq(userVotes.userPlexId, session.plexId), eq(userVotes.vote, "delete")));

  const [trimResult] = await db
    .select({ total: count() })
    .from(userVotes)
    .where(and(eq(userVotes.userPlexId, session.plexId), eq(userVotes.vote, "trim")));

  const [watchedResult] = await db
    .select({ total: count() })
    .from(watchStatus)
    .where(and(eq(watchStatus.userPlexId, session.plexId), eq(watchStatus.watched, true)));

  const totalRequests = totalResult?.total || 0;
  const keepCount = keepResult?.total || 0;
  const deleteCount = deleteResult?.total || 0;
  const trimCount = trimResult?.total || 0;
  const watchedCount = watchedResult?.total || 0;
  const unvotedCount = totalRequests - keepCount - deleteCount - trimCount;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div>
            <div className="flex items-baseline gap-2">
              <h1 className="text-xl font-bold">Shelflife</h1>
              <AppVersion />
            </div>
            <p className="text-sm text-gray-400">Welcome, {session.username}</p>
          </div>
          <div className="flex items-center gap-4">
            <a href="/community" className="text-sm text-gray-400 hover:text-gray-200">
              Community
            </a>
            {session.isAdmin && (
              <a href="/admin" className="text-sm text-[#e5a00d] hover:underline">
                Admin
              </a>
            )}
            <form action="/api/auth/logout" method="POST">
              <button className="text-sm text-gray-400 hover:text-gray-200">Sign Out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8">
        <DashboardContent
          totalRequests={totalRequests}
          keepCount={keepCount}
          deleteCount={deleteCount}
          trimCount={trimCount}
          unvotedCount={unvotedCount}
          watchedCount={watchedCount}
        />
      </main>
    </div>
  );
}
