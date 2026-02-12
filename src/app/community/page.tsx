import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { mediaItems, userVotes, communityVotes, reviewRounds } from "@/lib/db/schema";
import { eq, count, sql } from "drizzle-orm";
import { getNominationCondition } from "@/lib/db/queries";
import { CommunityContent } from "@/components/community/CommunityContent";
import { AppVersion } from "@/components/ui/AppVersion";

export default async function CommunityPage() {
  const session = await getSession();
  if (!session) redirect("/");

  // Count candidates — uses same condition as the community grid
  const [candidateResult] = await db
    .select({ total: sql<number>`COUNT(DISTINCT ${mediaItems.id})` })
    .from(mediaItems)
    .innerJoin(userVotes, getNominationCondition());

  // Count total community votes
  const [voteResult] = await db.select({ total: count() }).from(communityVotes);

  // Check for active review round
  const activeRoundResult = await db
    .select({
      name: reviewRounds.name,
      startedAt: reviewRounds.startedAt,
      endDate: reviewRounds.endDate,
    })
    .from(reviewRounds)
    .where(eq(reviewRounds.status, "active"))
    .limit(1);
  const activeRound = activeRoundResult[0] || null;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div>
            <div className="flex items-baseline gap-2">
              <h1 className="text-xl font-bold">Shelflife - Community Review</h1>
              <AppVersion />
            </div>
            <p className="text-sm text-gray-400">Vote on content nominated for removal</p>
          </div>
          <div className="flex items-center gap-4">
            <a href="/dashboard" className="text-sm text-gray-400 hover:text-gray-200">
              Dashboard
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
        <CommunityContent
          totalCandidates={candidateResult?.total || 0}
          totalVotes={voteResult?.total || 0}
          activeRound={activeRound}
        />
      </main>
    </div>
  );
}
