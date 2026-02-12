import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { computeMediaStats } from "@/lib/db/queries";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { AppVersion } from "@/components/ui/AppVersion";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/");

  const { total, nominated, notNominated, watched } = await computeMediaStats(
    session.plexId,
    "personal"
  );

  return (
    <div className="min-h-screen">
      <header className="border-t-brand sticky top-0 z-10 border-t-2 border-b border-b-gray-800 bg-gray-950/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div>
            <div className="flex items-baseline gap-2">
              <h1 className="text-xl font-extrabold tracking-tight">Shelflife</h1>
              <AppVersion />
            </div>
            <p className="text-sm text-gray-500">Welcome, {session.username}</p>
          </div>
          <nav className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-200">Dashboard</span>
            <a href="/community" className="text-sm text-gray-400 hover:text-gray-200">
              Community
            </a>
            {session.isAdmin && (
              <a href="/admin" className="text-brand text-sm hover:underline">
                Admin
              </a>
            )}
            <form action="/api/auth/logout" method="POST">
              <button className="text-sm text-gray-400 hover:text-gray-200">Sign Out</button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8">
        <DashboardContent
          totalRequests={total}
          nominatedCount={nominated}
          notNominatedCount={notNominated}
          watchedCount={watched}
        />
      </main>
    </div>
  );
}
