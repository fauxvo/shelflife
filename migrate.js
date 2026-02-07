// Standalone migration script - runs in Docker entrypoint before the app starts.
// Reads Drizzle-generated SQL migration files and executes them against SQLite.
// Safe to run repeatedly: catches "already exists" errors gracefully.

const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const dbPath = process.env.DATABASE_PATH || "/app/data/shelflife.db";
const migrationsDir = path.join(__dirname, "src/lib/db/migrations");

// Ensure data directory exists
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

if (!fs.existsSync(migrationsDir)) {
  console.log("No migrations directory found, skipping");
  db.close();
  process.exit(0);
}

const files = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

let applied = 0;
let skipped = 0;

for (const file of files) {
  const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
  // Drizzle uses '--> statement-breakpoint' to separate SQL statements
  const statements = sql.split("--> statement-breakpoint");

  for (const stmt of statements) {
    const trimmed = stmt.trim();
    if (!trimmed) continue;

    try {
      db.exec(trimmed);
      applied++;
    } catch (e) {
      if (e.message && e.message.includes("already exists")) {
        skipped++;
      } else {
        console.error(`Migration failed (${file}):`, e.message);
        db.close();
        process.exit(1);
      }
    }
  }
}

db.close();
console.log(
  `Migrations complete: ${applied} applied, ${skipped} already existed`
);
