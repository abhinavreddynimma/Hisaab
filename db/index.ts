import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "payroll.db");
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const sqlite = new Database(dbPath);

// Enable WAL mode for better performance
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("busy_timeout = 5000");

// Handle legacy DBs created before Drizzle migrations were introduced.
// If tables exist but __drizzle_migrations doesn't, this is a pre-migration DB.
// We add any missing columns and mark the initial migration as already applied.
const hasLegacyDb = (() => {
  const hasTables = sqlite.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='settings'"
  ).get();
  const hasMigrations = sqlite.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'"
  ).get();
  return hasTables && !hasMigrations;
})();

if (hasLegacyDb) {
  // Add columns that exist in the Drizzle schema but were missing from the old raw SQL
  const missingColumns = [
    "ALTER TABLE clients ADD COLUMN currency TEXT NOT NULL DEFAULT 'EUR'",
    "ALTER TABLE projects ADD COLUMN currency TEXT NOT NULL DEFAULT 'EUR'",
    "ALTER TABLE invoices ADD COLUMN currency TEXT NOT NULL DEFAULT 'EUR'",
  ];
  for (const sql of missingColumns) {
    try {
      sqlite.exec(sql);
    } catch {
      // Column already exists
    }
  }

  // Create the migrations tracking table and mark the initial migration as applied
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT NOT NULL UNIQUE,
      created_at NUMERIC
    );
  `);
  sqlite.prepare(
    "INSERT OR IGNORE INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)"
  ).run("0000_married_shinobi_shaw", Date.now());
}

export const db = drizzle(sqlite, { schema });

// Run migrations on startup (no-op for legacy DBs since 0000 is already marked as applied)
migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
