/**
 * Seed script: Populates the database with realistic demo data.
 * Usage: npx tsx scripts/seed-demo.ts
 */

import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

const DB_PATH = path.join(__dirname, "../data/payroll.db");

// Ensure data directory
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Remove existing DB if any
if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
  // Also remove WAL files
  for (const ext of ["-shm", "-wal", "-journal"]) {
    const f = DB_PATH + ext;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, company TEXT, gstin TEXT,
    address_line_1 TEXT, address_line_2 TEXT, city TEXT,
    state TEXT, pincode TEXT, email TEXT, phone TEXT, country TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL REFERENCES clients(id),
    name TEXT NOT NULL, default_daily_rate REAL NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS project_rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    month_key TEXT NOT NULL, daily_rate REAL NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS project_month_idx ON project_rates(project_id, month_key);
  CREATE TABLE IF NOT EXISTS day_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE, day_type TEXT NOT NULL,
    project_id INTEGER REFERENCES projects(id), notes TEXT
  );
  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT NOT NULL UNIQUE,
    client_id INTEGER NOT NULL REFERENCES clients(id),
    project_id INTEGER REFERENCES projects(id),
    billing_period_start TEXT NOT NULL, billing_period_end TEXT NOT NULL,
    issue_date TEXT NOT NULL, due_date TEXT,
    from_name TEXT, from_company TEXT, from_address TEXT,
    from_gstin TEXT, from_pan TEXT, from_email TEXT, from_phone TEXT,
    from_bank_name TEXT, from_bank_account TEXT, from_bank_ifsc TEXT,
    from_bank_branch TEXT, from_bank_iban TEXT, from_bank_bic TEXT,
    from_sepa_account_name TEXT, from_sepa_iban TEXT, from_sepa_bic TEXT,
    from_sepa_bank TEXT, from_sepa_account_type TEXT, from_sepa_address TEXT,
    from_swift_account_name TEXT, from_swift_iban TEXT, from_swift_bic TEXT,
    from_swift_bank TEXT, from_swift_account_type TEXT,
    to_name TEXT, to_company TEXT, to_address TEXT,
    to_gstin TEXT, to_email TEXT,
    subtotal REAL NOT NULL DEFAULT 0,
    cgst_rate REAL DEFAULT 0, cgst_amount REAL DEFAULT 0,
    sgst_rate REAL DEFAULT 0, sgst_amount REAL DEFAULT 0,
    igst_rate REAL DEFAULT 0, igst_amount REAL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft', notes TEXT,
    paid_date TEXT, eur_to_inr_rate REAL,
    platform_charges REAL, bank_charges REAL, net_inr_amount REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS invoice_line_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id),
    description TEXT NOT NULL, hsn_sac TEXT,
    quantity REAL NOT NULL, unit_price REAL NOT NULL, amount REAL NOT NULL
  );
  CREATE TABLE IF NOT EXISTS invoice_attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id),
    file_name TEXT NOT NULL, original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL, file_size INTEGER NOT NULL,
    label TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS tax_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    financial_year TEXT NOT NULL, quarter TEXT NOT NULL,
    amount REAL NOT NULL, payment_date TEXT NOT NULL,
    challan_no TEXT, notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ── Helpers ──

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function dateStr(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

function dayOfWeek(y: number, m: number, d: number): number {
  return new Date(y, m - 1, d).getDay(); // 0=Sun, 6=Sat
}

function isWeekend(y: number, m: number, d: number): boolean {
  const dow = dayOfWeek(y, m, d);
  return dow === 0 || dow === 6;
}

function computeEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const mm = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * mm + 114) / 31);
  const day = ((h + l - 7 * mm + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  const r = new Date(date);
  r.setDate(r.getDate() + days);
  return r;
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getFrenchHolidays(year: number): Set<string> {
  const easter = computeEaster(year);
  const holidays = new Set<string>();
  holidays.add(`${year}-01-01`);
  holidays.add(`${year}-05-01`);
  holidays.add(`${year}-05-08`);
  holidays.add(`${year}-07-14`);
  holidays.add(`${year}-08-15`);
  holidays.add(`${year}-11-01`);
  holidays.add(`${year}-11-11`);
  holidays.add(`${year}-12-25`);
  holidays.add(fmtDate(addDays(easter, 1)));   // Easter Monday
  holidays.add(fmtDate(addDays(easter, 39)));  // Ascension
  holidays.add(fmtDate(addDays(easter, 50)));  // Whit Monday
  return holidays;
}

// ── Seed Settings ──

console.log("Seeding settings...");

const upsert = db.prepare(
  "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
);

upsert.run("user_profile", JSON.stringify({
  name: "Rahul Sharma",
  company: "",
  addressLine1: "42, Koramangala 4th Block",
  addressLine2: "HSR Layout",
  city: "Bangalore",
  state: "Karnataka",
  pincode: "560034",
  country: "India",
  gstin: "29AABCS1429B1ZV",
  pan: "AABCS1429B",
  email: "rahul.sharma@example.com",
  phone: "+91 98765 43210",
  bankName: "State Bank of India",
  bankAccount: "00000039028837301",
  bankIfsc: "SBIN0001234",
  bankBranch: "Koramangala Branch",
  bankIban: "",
  bankBic: "",
  sepaAccountName: "Rahul Sharma",
  sepaIban: "FR76 3000 6000 0112 3456 7890 189",
  sepaBic: "BNPAFRPPXXX",
  sepaBank: "BNP Paribas",
  sepaAccountType: "Current",
  sepaAddress: "42 Koramangala, Bangalore 560034, India",
  swiftAccountName: "Rahul Sharma",
  swiftIban: "FR76 3000 6000 0112 3456 7890 189",
  swiftBic: "BNPAFRPPXXX",
  swiftBank: "BNP Paribas",
  swiftAccountType: "Current",
}));

upsert.run("invoice_settings", JSON.stringify({
  prefix: "HSB",
  nextNumber: 13,
  defaultHsnSac: "998314",
  defaultTaxRate: 18,
  taxType: "igst",
}));

upsert.run("leave_policy", JSON.stringify({
  leavesPerMonth: 2,
  standardWorkingDays: 22,
  trackingStartDate: "2025-04",
}));

upsert.run("default_project", JSON.stringify({ projectId: 1 }));

// ── Seed Client ──

console.log("Seeding client...");

db.prepare(`
  INSERT INTO clients (name, company, gstin, address_line_1, address_line_2, city, state, pincode, email, phone, country, is_active, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
`).run(
  "Pierre Martin",
  "TechVision SAS",
  null,
  "14 Rue de Rivoli",
  "3ème étage",
  "Paris",
  "Île-de-France",
  "75001",
  "pierre.martin@techvision.fr",
  "+33 1 42 60 31 00",
  "France",
  "2025-04-01T10:00:00.000Z",
);

// ── Seed Project ──

console.log("Seeding project...");

db.prepare(`
  INSERT INTO projects (client_id, name, default_daily_rate, is_active, created_at)
  VALUES (1, ?, 250, 1, ?)
`).run("Frontend Development", "2025-04-01T10:00:00.000Z");

// ── Seed Day Entries ──

console.log("Seeding day entries...");

const insertDay = db.prepare(
  "INSERT OR REPLACE INTO day_entries (date, day_type, project_id, notes) VALUES (?, ?, ?, ?)"
);

// Define leaves per month (spread across the month for realism)
const leaveDays: Record<string, number[]> = {
  "2025-04": [10, 11],      // Thu-Fri
  "2025-05": [19],           // Mon
  "2025-06": [6, 23],        // Fri, Mon
  "2025-07": [7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 21, 22, 23, 24, 25, 28, 29, 30, 31], // Summer leave
  "2025-08": [1, 18, 19],    // Fri, Mon-Tue
  "2025-09": [12, 26],       // Fri, Fri
  "2025-10": [3, 17],        // Fri, Fri
  "2025-11": [14],           // Fri
  "2025-12": [22, 23, 24, 26, 29, 30, 31], // Christmas break
  "2026-01": [2, 3],         // Thu-Fri (new year)
  "2026-02": [14, 28],       // Fri, Fri (Valentine's + end of month)
  "2026-03": [13, 27],       // Fri, Fri
};

// Half days
const halfDays: Record<string, number[]> = {
  "2025-05": [30],   // Fri before long weekend
  "2025-08": [29],   // Fri
  "2025-10": [31],   // Halloween
  "2025-12": [19],   // Fri before Christmas break
  "2026-02": [20],   // Fri
  "2026-03": [20],   // Fri before spring break
};

// Extra working days (Saturdays)
const extraWorkingDays: Record<string, number[]> = {
  "2025-06": [14],   // Sat
  "2025-09": [6],    // Sat
  "2025-11": [8],    // Sat
  "2026-03": [7],    // Sat
};

// Full financial year: April 2025 through March 2026
const months = [
  [2025, 4], [2025, 5], [2025, 6], [2025, 7], [2025, 8],
  [2025, 9], [2025, 10], [2025, 11], [2025, 12],
  [2026, 1], [2026, 2], [2026, 3],
];

const workingDaysPerMonth: Record<string, number> = {};

const seedDays = db.transaction(() => {
  for (const [year, month] of months) {
    const key = `${year}-${pad(month)}`;
    const holidays = getFrenchHolidays(year);
    const dim = daysInMonth(year, month);
    const leaveSet = new Set(leaveDays[key] ?? []);
    const halfSet = new Set(halfDays[key] ?? []);
    const extraSet = new Set(extraWorkingDays[key] ?? []);
    let workCount = 0;

    for (let d = 1; d <= dim; d++) {
      const ds = dateStr(year, month, d);
      let dayType: string;
      let projectId: number | null = 1;

      if (extraSet.has(d)) {
        dayType = "extra_working";
        workCount += 1;
      } else if (isWeekend(year, month, d)) {
        dayType = "weekend";
        projectId = null;
      } else if (holidays.has(ds)) {
        dayType = "holiday";
        projectId = null;
      } else if (leaveSet.has(d)) {
        dayType = "leave";
        projectId = null;
      } else if (halfSet.has(d)) {
        dayType = "half_day";
        workCount += 0.5;
      } else {
        dayType = "working";
        workCount += 1;
      }

      insertDay.run(ds, dayType, projectId, null);
    }

    workingDaysPerMonth[key] = workCount;
    console.log(`  ${key}: ${workCount} effective working days`);
  }
});

seedDays();

// ── Seed Invoices ──

console.log("Seeding invoices...");

const DAILY_RATE = 250;
const IGST_RATE = 18;

const fromProfile = {
  name: "Rahul Sharma",
  address: "42, Koramangala 4th Block, HSR Layout, Bangalore, Karnataka 560034, India",
  gstin: "29AABCS1429B1ZV",
  pan: "AABCS1429B",
  email: "rahul.sharma@example.com",
  phone: "+91 98765 43210",
  bankName: "State Bank of India",
  bankAccount: "00000039028837301",
  bankIfsc: "SBIN0001234",
  bankBranch: "Koramangala Branch",
  sepaAccountName: "Rahul Sharma",
  sepaIban: "FR76 3000 6000 0112 3456 7890 189",
  sepaBic: "BNPAFRPPXXX",
  sepaBank: "BNP Paribas",
};

const toClient = {
  name: "Pierre Martin",
  company: "TechVision SAS",
  address: "14 Rue de Rivoli, 3ème étage, Paris, Île-de-France 75001, France",
  email: "pierre.martin@techvision.fr",
};

// EUR-INR exchange rates that vary realistically
const exchangeRates: Record<string, number> = {
  "2025-04": 91.25, "2025-05": 91.80, "2025-06": 92.10,
  "2025-07": 91.50, "2025-08": 92.45, "2025-09": 92.80,
  "2025-10": 93.10, "2025-11": 92.60, "2025-12": 93.40,
  "2026-01": 93.75, "2026-02": 94.10, "2026-03": 93.90,
};

interface InvoiceConfig {
  monthKey: string;
  status: "paid" | "sent" | "draft";
}

const invoiceConfigs: InvoiceConfig[] = [
  { monthKey: "2025-04", status: "paid" },
  { monthKey: "2025-05", status: "paid" },
  { monthKey: "2025-06", status: "paid" },
  { monthKey: "2025-07", status: "paid" },
  { monthKey: "2025-08", status: "paid" },
  { monthKey: "2025-09", status: "paid" },
  { monthKey: "2025-10", status: "paid" },
  { monthKey: "2025-11", status: "paid" },
  { monthKey: "2025-12", status: "paid" },
  { monthKey: "2026-01", status: "paid" },
  { monthKey: "2026-02", status: "sent" },
  { monthKey: "2026-03", status: "draft" },
];

const insertInvoice = db.prepare(`
  INSERT INTO invoices (
    invoice_number, client_id, project_id,
    billing_period_start, billing_period_end, issue_date, due_date,
    from_name, from_company, from_address, from_gstin, from_pan, from_email, from_phone,
    from_bank_name, from_bank_account, from_bank_ifsc, from_bank_branch,
    from_sepa_account_name, from_sepa_iban, from_sepa_bic, from_sepa_bank,
    from_sepa_account_type, from_sepa_address,
    to_name, to_company, to_address, to_gstin, to_email,
    subtotal, igst_rate, igst_amount, total,
    status, paid_date, eur_to_inr_rate, platform_charges, bank_charges, net_inr_amount,
    created_at
  ) VALUES (
    ?, 1, 1,
    ?, ?, ?, ?,
    ?, ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?,
    ?, ?, ?, ?,
    ?, ?,
    ?, ?, ?, ?, ?,
    ?, ?, ?, ?,
    ?, ?, ?, ?, ?, ?,
    ?
  )
`);

const insertLineItem = db.prepare(`
  INSERT INTO invoice_line_items (invoice_id, description, hsn_sac, quantity, unit_price, amount)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const seedInvoices = db.transaction(() => {
  for (let i = 0; i < invoiceConfigs.length; i++) {
    const cfg = invoiceConfigs[i];
    const [yearStr, monthStr] = cfg.monthKey.split("-");
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);
    const dim = daysInMonth(year, month);

    const invoiceNumber = `HSB-${pad(i + 1)}`;  // HSB-01 to HSB-10
    const periodStart = `${cfg.monthKey}-01`;
    const periodEnd = `${cfg.monthKey}-${pad(dim)}`;
    const issueDate = dateStr(year, month === 12 ? month : month + 1, 1); // 1st of next month
    const dueDate = dateStr(year, month === 12 ? month : month + 1, 15);

    // Fix year rollover for Jan issue dates
    const issueDateFixed = month === 12
      ? dateStr(year + 1, 1, 1)
      : issueDate;
    const dueDateFixed = month === 12
      ? dateStr(year + 1, 1, 15)
      : dueDate;

    const workDays = workingDaysPerMonth[cfg.monthKey] ?? 20;
    const subtotal = workDays * DAILY_RATE;
    const igstAmount = +(subtotal * IGST_RATE / 100).toFixed(2);
    const total = +(subtotal + igstAmount).toFixed(2);

    const rate = exchangeRates[cfg.monthKey] ?? 92;
    let paidDate: string | null = null;
    let eurToInrRate: number | null = null;
    let platformCharges: number | null = null;
    let bankCharges: number | null = null;
    let netInrAmount: number | null = null;

    if (cfg.status === "paid") {
      // Paid ~15-20 days after issue
      const issueD = new Date(issueDateFixed);
      const paidD = addDays(issueD, 15 + Math.floor(Math.random() * 6));
      paidDate = fmtDate(paidD);
      eurToInrRate = rate + (Math.random() * 0.5 - 0.25); // slight variation
      platformCharges = +(3 + Math.random() * 2).toFixed(2);  // €3-5
      bankCharges = +(200 + Math.random() * 300).toFixed(0);   // ₹200-500
      const grossInr = total * eurToInrRate;
      netInrAmount = +(grossInr - (platformCharges * eurToInrRate) - bankCharges).toFixed(2);
    }

    insertInvoice.run(
      invoiceNumber, periodStart, periodEnd, issueDateFixed, dueDateFixed,
      fromProfile.name, "", fromProfile.address, fromProfile.gstin, fromProfile.pan,
      fromProfile.email, fromProfile.phone,
      fromProfile.bankName, fromProfile.bankAccount, fromProfile.bankIfsc, fromProfile.bankBranch,
      fromProfile.sepaAccountName, fromProfile.sepaIban, fromProfile.sepaBic, fromProfile.sepaBank,
      "Current", "42 Koramangala, Bangalore 560034, India",
      toClient.name, toClient.company, toClient.address, null, toClient.email,
      subtotal, IGST_RATE, igstAmount, total,
      cfg.status, paidDate, eurToInrRate, platformCharges, bankCharges, netInrAmount,
      new Date().toISOString(),
    );

    // Get the inserted invoice ID
    const invoiceId = i + 1;

    // Insert line item
    insertLineItem.run(
      invoiceId,
      `${workDays} working days - Frontend Development @ €${DAILY_RATE}/day`,
      "998314",
      workDays,
      DAILY_RATE,
      subtotal,
    );

    console.log(`  ${invoiceNumber}: ${workDays} days, €${total.toFixed(2)}, status=${cfg.status}`);
  }
});

seedInvoices();

// ── Seed Tax Payments ──

console.log("Seeding tax payments...");

const insertTax = db.prepare(`
  INSERT INTO tax_payments (financial_year, quarter, amount, payment_date, challan_no, notes, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const taxPayments = [
  { fy: "2025-26", q: "Q1", amount: 75000, date: "2025-06-15", challan: "CRN2025061500123", notes: "Advance tax Q1" },
  { fy: "2025-26", q: "Q2", amount: 80000, date: "2025-09-15", challan: "CRN2025091500456", notes: "Advance tax Q2" },
  { fy: "2025-26", q: "Q3", amount: 85000, date: "2025-12-15", challan: "CRN2025121500789", notes: "Advance tax Q3" },
  { fy: "2025-26", q: "Q4", amount: 90000, date: "2026-03-15", challan: "CRN2026031500321", notes: "Advance tax Q4" },
];

for (const tp of taxPayments) {
  insertTax.run(tp.fy, tp.q, tp.amount, tp.date, tp.challan, tp.notes, new Date().toISOString());
  console.log(`  ${tp.fy} ${tp.q}: ₹${tp.amount.toLocaleString()}`);
}

// ── Done ──

db.close();
console.log("\nDemo data seeded successfully!");
