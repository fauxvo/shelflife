/**
 * One-time cleanup: remove stale vote values from before the voting simplification.
 * - user_votes with vote='keep' (no longer a valid value)
 * - community_votes with vote='remove' (no longer a valid value)
 *
 * Run: bun scripts/cleanup-stale-votes.ts
 */

import { db } from "@/lib/db";
import { userVotes, communityVotes } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";

async function main() {
  const [keepResult] = await db
    .select({ total: count() })
    .from(userVotes)
    .where(eq(userVotes.vote, "keep" as "delete"));
  const [removeResult] = await db
    .select({ total: count() })
    .from(communityVotes)
    .where(eq(communityVotes.vote, "remove" as "keep"));

  const keepCount = keepResult?.total || 0;
  const removeCount = removeResult?.total || 0;

  console.warn(`Found ${keepCount} stale user_votes with vote='keep'`);
  console.warn(`Found ${removeCount} stale community_votes with vote='remove'`);

  if (keepCount === 0 && removeCount === 0) {
    console.warn("Nothing to clean up.");
    process.exit(0);
  }

  const deleted1 = await db.delete(userVotes).where(eq(userVotes.vote, "keep" as "delete"));
  const deleted2 = await db
    .delete(communityVotes)
    .where(eq(communityVotes.vote, "remove" as "keep"));

  console.warn(`Deleted user_votes rows: ${JSON.stringify(deleted1.changes)}`);
  console.warn(`Deleted community_votes rows: ${JSON.stringify(deleted2.changes)}`);
  console.warn("Cleanup complete.");
}

main();
