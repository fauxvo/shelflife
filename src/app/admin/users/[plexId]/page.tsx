import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { users, mediaItems, userVotes, watchStatus } from "@/lib/db/schema";
import { eq, and, count } from "drizzle-orm";
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

  const [keepResult] = await db
    .select({ total: count() })
    .from(userVotes)
    .where(and(eq(userVotes.userPlexId, plexId), eq(userVotes.vote, "keep")));

  const [deleteResult] = await db
    .select({ total: count() })
    .from(userVotes)
    .where(and(eq(userVotes.userPlexId, plexId), eq(userVotes.vote, "delete")));

  const [watchedResult] = await db
    .select({ total: count() })
    .from(watchStatus)
    .where(and(eq(watchStatus.userPlexId, plexId), eq(watchStatus.watched, true)));

  const totalRequests = totalResult?.total || 0;
  const keepCount = keepResult?.total || 0;
  const deleteCount = deleteResult?.total || 0;
  const watchedCount = watchedResult?.total || 0;
  const unvotedCount = totalRequests - keepCount - deleteCount;

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/admin" className="text-gray-400 hover:text-gray-200">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                <img src={user.avatarUrl} alt={user.username} className="w-8 h-8 rounded-full" />
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
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        <AdminUserContent
          plexId={plexId}
          totalRequests={totalRequests}
          keepCount={keepCount}
          deleteCount={deleteCount}
          unvotedCount={unvotedCount}
          watchedCount={watchedCount}
        />
      </main>
    </div>
  );
}
