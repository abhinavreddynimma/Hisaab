/**
 * Migration script: Reads the old Streamlit app's payroll_data.json
 * and populates the new SQLite database with equivalent data.
 *
 * Usage: npx tsx scripts/migrate-from-json.ts
 */

import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

const OLD_DATA_PATH = path.join(
  __dirname,
  "../../Leaves-ExtraWorkDays/payroll_data.json"
);
const DB_PATH = path.join(__dirname, "../data/payroll.db");

interface OldRecord {
  total_working_days: number;
  leaves_taken: number;
  extra_working_days: number;
}

interface OldData {
  leave_policy: number;
  start_date: string; // "YYYY-MM"
  records: Record<string, OldRecord>;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function isWeekend(year: number, month: number, day: number): boolean {
  const date = new Date(year, month - 1, day);
  const dow = date.getDay();
  return dow === 0 || dow === 6;
}

function migrate() {
  console.log("=== Payroll Data Migration ===\n");

  // Read old data
  if (!fs.existsSync(OLD_DATA_PATH)) {
    console.error(`Old data file not found at: ${OLD_DATA_PATH}`);
    process.exit(1);
  }

  const oldData: OldData = JSON.parse(fs.readFileSync(OLD_DATA_PATH, "utf-8"));
  console.log(`Found old data with ${Object.keys(oldData.records).length} months`);
  console.log(`Leave policy: ${oldData.leave_policy} per month`);
  console.log(`Start date: ${oldData.start_date}\n`);

  // Ensure data directory exists
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Open database
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS day_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      day_type TEXT NOT NULL,
      project_id INTEGER,
      notes TEXT
    );
  `);

  // Migrate settings
  console.log("Migrating settings...");

  const upsertSetting = db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  );

  upsertSetting.run(
    "leave_policy",
    JSON.stringify({
      leavesPerMonth: oldData.leave_policy,
      standardWorkingDays: 22,
      trackingStartDate: oldData.start_date,
    })
  );
  console.log("  Leave policy migrated");

  // Migrate monthly records to day entries
  console.log("\nMigrating monthly records to day entries...");

  const insertDayEntry = db.prepare(
    "INSERT OR REPLACE INTO day_entries (date, day_type, project_id, notes) VALUES (?, ?, ?, ?)"
  );

  const migrateTx = db.transaction(() => {
    for (const [monthKey, record] of Object.entries(oldData.records)) {
      const [yearStr, monthStr] = monthKey.split("-");
      const year = parseInt(yearStr);
      const month = parseInt(monthStr);
      const daysInMonth = getDaysInMonth(year, month);

      console.log(`\n  Processing ${monthKey}:`);
      console.log(`    Working days: ${record.total_working_days}`);
      console.log(`    Leaves: ${record.leaves_taken}`);
      console.log(`    Extra working: ${record.extra_working_days}`);

      // Strategy:
      // 1. Mark weekends as weekend
      // 2. Mark leaves at end of month (before weekends)
      // 3. Mark extra working days on weekends (starting from first weekend)
      // 4. Mark remaining weekdays as working

      const weekdays: number[] = [];
      const weekendDays: number[] = [];

      for (let day = 1; day <= daysInMonth; day++) {
        if (isWeekend(year, month, day)) {
          weekendDays.push(day);
        } else {
          weekdays.push(day);
        }
      }

      // Determine leaves (place at end of weekdays)
      const leaveDays = Math.floor(record.leaves_taken);
      const halfDayLeaves = record.leaves_taken - leaveDays;
      const totalLeaveDaySlots = leaveDays + (halfDayLeaves > 0 ? 1 : 0);
      const leaveWeekdays = totalLeaveDaySlots > 0
        ? weekdays.slice(-totalLeaveDaySlots)
        : [];

      // Determine extra working days (place on early weekends)
      const extraCount = Math.floor(record.extra_working_days);
      const extraWeekends = weekendDays.slice(0, extraCount);

      let entriesCreated = 0;

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        let dayType: string;

        if (extraWeekends.includes(day)) {
          dayType = "extra_working";
        } else if (weekendDays.includes(day)) {
          dayType = "weekend";
        } else if (leaveWeekdays.includes(day)) {
          // Check if this is the half-day
          if (halfDayLeaves > 0 && day === leaveWeekdays[0]) {
            dayType = "half_day";
          } else {
            dayType = "leave";
          }
        } else {
          dayType = "working";
        }

        insertDayEntry.run(dateStr, dayType, null, "Migrated from old app");
        entriesCreated++;
      }

      console.log(`    Created ${entriesCreated} day entries`);

      // Verify
      const workingCount = weekdays.length - leaveWeekdays.length + extraCount;
      console.log(`    Verification - calculated working: ${workingCount}, original: ${record.total_working_days}`);
      if (Math.abs(workingCount - record.total_working_days) > 1) {
        console.log(`    ⚠️  DISCREPANCY detected`);
      } else {
        console.log(`    ✓ Matches (within tolerance)`);
      }
    }
  });

  migrateTx();

  // Summary
  const totalEntries = db
    .prepare("SELECT COUNT(*) as count FROM day_entries")
    .get() as { count: number };
  const totalSettings = db
    .prepare("SELECT COUNT(*) as count FROM settings")
    .get() as { count: number };

  console.log("\n=== Migration Complete ===");
  console.log(`Settings: ${totalSettings.count}`);
  console.log(`Day entries: ${totalEntries.count}`);

  db.close();
}

migrate();
