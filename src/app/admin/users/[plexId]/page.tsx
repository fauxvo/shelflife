import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { users, mediaItems, userVotes, watchStatus } from "@/lib/db/schema";
import { eq, and, count, countDistinct, inArray, ne } from "drizzle-orm";
import { AdminUserContent } from "@/components/admin/AdminUserContent";

export default async function AdminUserPage({ params }: { params: Promise<{ plexId: string }> }) {
  const session = await getSession();
  if (!session?.isAdmin) redirect("/");

  const { plexId } = await params;

  // Get user info
  const [user] = await db.select().from(users).where(eq(users.plexId, plexId)).limit(1);

  if (!user) notFound();

  // Get stats
  const [totalResult] = await db
    .select({ total: count() })
    .from(mediaItems)
    .where(eq(mediaItems.requestedByPlexId, plexId));

  const [activeResult] = await db
    .select({ total: count() })
    .from(mediaItems)
    .where(and(eq(mediaItems.requestedByPlexId, plexId), ne(mediaItems.status, "removed")));

  const [nominatedResult] = await db
    .select({ total: countDistinct(userVotes.mediaItemId) })
    .from(userVotes)
    .innerJoin(mediaItems, eq(userVotes.mediaItemId, mediaItems.id))
    .where(
      and(eq(mediaItems.requestedByPlexId, plexId), inArray(userVotes.vote, ["delete", "trim"]))
    );

  const [watchedResult] = await db
    .select({ total: count() })
    .from(watchStatus)
    .where(and(eq(watchStatus.userPlexId, plexId), eq(watchStatus.watched, true)));

  const totalRequests = totalResult?.total || 0;
  const activeRequests = activeResult?.total || 0;
  const nominatedCount = nominatedResult?.total || 0;
  const notNominatedCount = activeRequests - nominatedCount;
  const watchedCount = watchedResult?.total || 0;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <a href="/admin" className="text-gray-400 hover:text-gray-200">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </a>
            <div className="flex items-center gap-3">
              {user.avatarUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatarUrl} alt={user.username} className="h-8 w-8 rounded-full" />
              )}
              <div>
                <h1 className="text-xl font-bold">{user.username}</h1>
                <p className="text-sm text-gray-400">
                  {user.email || "No email"} {user.isAdmin && " \u00b7 Admin"}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a href="/admin" className="text-sm text-gray-400 hover:text-gray-200">
              Back to Admin
            </a>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8">
        <AdminUserContent
          plexId={plexId}
          totalRequests={totalRequests}
          activeRequests={activeRequests}
          nominatedCount={nominatedCount}
          notNominatedCount={notNominatedCount}
          watchedCount={watchedCount}
        />
      </main>
    </div>
  );
}
