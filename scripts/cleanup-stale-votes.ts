/**
 * One-time cleanup: remove stale vote values from before the voting simplification.
 * - user_votes with vote='keep' (no longer a valid value)
 * - community_votes with vote='remove' (no longer a valid value)
 *
 * Run: bun scripts/cleanup-stale-votes.ts
 */

import Database from "better-sqlite3";
import path from "path";

const dbPath =
  process.env.DATABASE_URL?.replace("file:", "") ||
  path.join(process.cwd(), "data", "shelflife.db");

console.log(`Opening database: ${dbPath}`);
const sqlite = new Database(dbPath);

const keepVotes = sqlite
  .prepare("SELECT COUNT(*) as count FROM user_votes WHERE vote = 'keep'")
  .get() as { count: number };
const removeVotes = sqlite
  .prepare("SELECT COUNT(*) as count FROM community_votes WHERE vote = 'remove'")
  .get() as { count: number };

console.log(`Found ${keepVotes.count} stale user_votes with vote='keep'`);
console.log(`Found ${removeVotes.count} stale community_votes with vote='remove'`);

if (keepVotes.count === 0 && removeVotes.count === 0) {
  console.log("Nothing to clean up.");
  process.exit(0);
}

const result1 = sqlite.prepare("DELETE FROM user_votes WHERE vote = 'keep'").run();
const result2 = sqlite.prepare("DELETE FROM community_votes WHERE vote = 'remove'").run();

console.log(`Deleted ${result1.changes} user_votes rows`);
console.log(`Deleted ${result2.changes} community_votes rows`);
console.log("Cleanup complete.");

sqlite.close();
