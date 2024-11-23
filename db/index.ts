import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

function initDb() {
  const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "payroll.db");
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const sqlite = new Database(dbPath);

  // Set busy timeout FIRST to avoid SQLITE_BUSY during concurrent access
  sqlite.pragma("busy_timeout = 10000");
  // Enable WAL mode for better performance
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  // Handle legacy DBs created before Drizzle migrations were introduced.
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

  const database = drizzle(sqlite, { schema });

  // Run migrations on startup unless explicitly disabled (e.g. image build stage).
  if (process.env.SKIP_DB_MIGRATIONS !== "true") {
    migrate(database, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  }

  return database;
}

// Lazy singleton: DB is only initialized on first access, not at module load time.
// This prevents SQLITE_BUSY errors when multiple Next.js build workers import this module.
let _db: ReturnType<typeof initDb> | null = null;

export const db = new Proxy({} as ReturnType<typeof initDb>, {
  get(_target, prop, receiver) {
    if (!_db) {
      _db = initDb();
    }
    const value = (_db as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === "function") {
      return value.bind(_db);
    }
    return value;
  },
});
