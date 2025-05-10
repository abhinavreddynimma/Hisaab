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
    currency TEXT NOT NULL DEFAULT 'EUR',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL REFERENCES clients(id),
    name TEXT NOT NULL, default_daily_rate REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'EUR',
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
    currency TEXT NOT NULL DEFAULT 'EUR',
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
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer',
    tag TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users(email);
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE UNIQUE INDEX IF NOT EXISTS sessions_token_hash_idx ON sessions(token_hash);
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
  nextNumber: 11,
  defaultHsnSac: "998314",
  defaultTaxRate: 18,
  taxType: "igst",
}));

upsert.run("leave_policy", JSON.stringify({
  leavesPerMonth: 1.5,
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
  VALUES (1, ?, 130, 1, ?)
`).run("Frontend Development", "2025-04-01T10:00:00.000Z");

// ── Seed Day Entries ──

console.log("Seeding day entries...");

const insertDay = db.prepare(
  "INSERT OR REPLACE INTO day_entries (date, day_type, project_id, notes) VALUES (?, ?, ?, ?)"
);

// Leave days distribution (17 full leaves across Apr 2025 – Feb 2026)
// With 1.5 leaves/month × 11 months = 16.5 gained
// 17 full + 4 half×0.5 = 19 consumed → balance = 16.5 - 19 = -2.5
const leaveDays: Record<string, number[]> = {
  "2025-04": [10, 11],     // Thu, Fri
  "2025-05": [19],          // Mon
  "2025-06": [20],          // Fri
  "2025-07": [7, 21, 28],   // Mon, Mon, Mon (summer)
  "2025-08": [18, 22],      // Mon, Fri
  "2025-09": [12],          // Fri
  "2025-10": [3],           // Fri
  "2025-11": [14],          // Fri
  "2025-12": [22, 23, 26],  // Mon, Tue, Fri (Christmas break)
  "2026-01": [2],           // Fri (after New Year)
  "2026-02": [6],           // Fri
};

// Half days (4 total)
const halfDays: Record<string, number[]> = {
  "2025-07": [11, 25],  // Fri, Fri (summer half days)
  "2025-10": [31],       // Fri (Halloween)
  "2025-12": [19],       // Fri (before Christmas break)
};

// Extra working Saturdays (7 total)
const extraWorkingDays: Record<string, number[]> = {
  "2025-06": [14],  // Sat
  "2025-08": [9],   // Sat
  "2025-09": [6],   // Sat
  "2025-10": [18],  // Sat
  "2025-11": [8],   // Sat
  "2026-01": [10],  // Sat
  "2026-02": [7],   // Sat
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

const DAILY_RATE = 130;
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

// Actual historical EUR-INR monthly average rates
const exchangeRates: Record<string, number> = {
  "2025-04": 96.05,
  "2025-05": 96.07,
  "2025-06": 98.97,
  "2025-07": 100.68,
  "2025-08": 101.93,
  "2025-09": 103.56,
  "2025-10": 102.94,
  "2025-11": 102.79,
  "2025-12": 105.40,
  "2026-01": 105.01,
};

// Platform charges (EUR) and bank charges (INR) per invoice
const platformChargesArr = [3.50, 4.00, 3.75, 4.25, 3.80, 3.60, 4.10, 3.90, 4.00, 3.70];
const bankChargesArr = [250, 300, 275, 350, 225, 280, 320, 260, 310, 240];

interface InvoiceConfig {
  monthKey: string;
  status: "paid" | "sent" | "draft";
  paidDate: string;
}

// 10 invoices, all paid (Apr 2025 – Jan 2026)
const invoiceConfigs: InvoiceConfig[] = [
  { monthKey: "2025-04", status: "paid", paidDate: "2025-05-19" },
  { monthKey: "2025-05", status: "paid", paidDate: "2025-06-17" },
  { monthKey: "2025-06", status: "paid", paidDate: "2025-07-18" },
  { monthKey: "2025-07", status: "paid", paidDate: "2025-08-18" },
  { monthKey: "2025-08", status: "paid", paidDate: "2025-09-18" },
  { monthKey: "2025-09", status: "paid", paidDate: "2025-10-17" },
  { monthKey: "2025-10", status: "paid", paidDate: "2025-11-17" },
  { monthKey: "2025-11", status: "paid", paidDate: "2025-12-18" },
  { monthKey: "2025-12", status: "paid", paidDate: "2026-01-16" },
  { monthKey: "2026-01", status: "paid", paidDate: "2026-02-09" },
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

    const invoiceNumber = `HSB-${pad(i + 1)}`;
    const periodStart = `${cfg.monthKey}-01`;
    const periodEnd = `${cfg.monthKey}-${pad(dim)}`;

    // Issue date: 1st of next month
    let issueYear = year;
    let issueMonth = month + 1;
    if (issueMonth > 12) { issueMonth = 1; issueYear++; }
    const issueDate = dateStr(issueYear, issueMonth, 1);
    const dueDate = dateStr(issueYear, issueMonth, 15);

    const workDays = workingDaysPerMonth[cfg.monthKey] ?? 20;
    const subtotal = workDays * DAILY_RATE;
    const igstAmount = +(subtotal * IGST_RATE / 100).toFixed(2);
    const total = +(subtotal + igstAmount).toFixed(2);

    const rate = exchangeRates[cfg.monthKey] ?? 100;
    const platformCharges = platformChargesArr[i];
    const bankCharges = bankChargesArr[i];
    const grossInr = total * rate;
    const netInrAmount = +(grossInr - (platformCharges * rate) - bankCharges).toFixed(2);

    insertInvoice.run(
      invoiceNumber, periodStart, periodEnd, issueDate, dueDate,
      fromProfile.name, "", fromProfile.address, fromProfile.gstin, fromProfile.pan,
      fromProfile.email, fromProfile.phone,
      fromProfile.bankName, fromProfile.bankAccount, fromProfile.bankIfsc, fromProfile.bankBranch,
      fromProfile.sepaAccountName, fromProfile.sepaIban, fromProfile.sepaBic, fromProfile.sepaBank,
      "Current", "42 Koramangala, Bangalore 560034, India",
      toClient.name, toClient.company, toClient.address, null, toClient.email,
      subtotal, IGST_RATE, igstAmount, total,
      cfg.status, cfg.paidDate, rate, platformCharges, bankCharges, netInrAmount,
      new Date().toISOString(),
    );

    const invoiceId = i + 1;

    insertLineItem.run(
      invoiceId,
      `${workDays} working days - Frontend Development @ €${DAILY_RATE}/day`,
      "998314",
      workDays,
      DAILY_RATE,
      subtotal,
    );

    console.log(`  ${invoiceNumber}: ${workDays} days, €${total.toFixed(2)}, ₹${netInrAmount.toLocaleString()}, status=${cfg.status}`);
  }
});

seedInvoices();

// ── Seed Tax Payments ──

console.log("Seeding tax payments...");

const insertTax = db.prepare(`
  INSERT INTO tax_payments (financial_year, quarter, amount, payment_date, challan_no, notes, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const taxPaymentsData = [
  { fy: "2025-26", q: "Q1", amount: 25000, date: "2025-06-15", challan: "CRN2025061500123", notes: "Advance tax Q1" },
  { fy: "2025-26", q: "Q2", amount: 25000, date: "2025-09-15", challan: "CRN2025091500456", notes: "Advance tax Q2" },
  { fy: "2025-26", q: "Q3", amount: 30000, date: "2025-12-15", challan: "CRN2025121500789", notes: "Advance tax Q3" },
];

for (const tp of taxPaymentsData) {
  insertTax.run(tp.fy, tp.q, tp.amount, tp.date, tp.challan, tp.notes, new Date().toISOString());
  console.log(`  ${tp.fy} ${tp.q}: ₹${tp.amount.toLocaleString()}`);
}

// ── Done ──

db.close();
console.log("\nDemo data seeded successfully!");
