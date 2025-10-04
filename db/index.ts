import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "payroll.db");
const sqlite = new Database(dbPath);

// Enable WAL mode for better performance
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

// Create tables if they don't exist
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    company TEXT,
    gstin TEXT,
    address_line_1 TEXT,
    address_line_2 TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    email TEXT,
    phone TEXT,
    country TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL REFERENCES clients(id),
    name TEXT NOT NULL,
    default_daily_rate REAL NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS project_rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    month_key TEXT NOT NULL,
    daily_rate REAL NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS project_month_idx ON project_rates(project_id, month_key);

  CREATE TABLE IF NOT EXISTS day_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    day_type TEXT NOT NULL,
    project_id INTEGER REFERENCES projects(id),
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT NOT NULL UNIQUE,
    client_id INTEGER NOT NULL REFERENCES clients(id),
    project_id INTEGER REFERENCES projects(id),
    billing_period_start TEXT NOT NULL,
    billing_period_end TEXT NOT NULL,
    issue_date TEXT NOT NULL,
    due_date TEXT,
    from_name TEXT,
    from_company TEXT,
    from_address TEXT,
    from_gstin TEXT,
    from_pan TEXT,
    from_email TEXT,
    from_phone TEXT,
    from_bank_name TEXT,
    from_bank_account TEXT,
    from_bank_ifsc TEXT,
    from_bank_branch TEXT,
    from_bank_iban TEXT,
    from_bank_bic TEXT,
    from_sepa_account_name TEXT,
    from_sepa_iban TEXT,
    from_sepa_bic TEXT,
    from_sepa_bank TEXT,
    from_sepa_account_type TEXT,
    from_sepa_address TEXT,
    from_swift_account_name TEXT,
    from_swift_iban TEXT,
    from_swift_bic TEXT,
    from_swift_bank TEXT,
    from_swift_account_type TEXT,
    to_name TEXT,
    to_company TEXT,
    to_address TEXT,
    to_gstin TEXT,
    to_email TEXT,
    subtotal REAL NOT NULL DEFAULT 0,
    cgst_rate REAL DEFAULT 0,
    cgst_amount REAL DEFAULT 0,
    sgst_rate REAL DEFAULT 0,
    sgst_amount REAL DEFAULT 0,
    igst_rate REAL DEFAULT 0,
    igst_amount REAL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft',
    notes TEXT,
    paid_date TEXT,
    eur_to_inr_rate REAL,
    platform_charges REAL,
    bank_charges REAL,
    net_inr_amount REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS invoice_attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id),
    file_name TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    label TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tax_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    financial_year TEXT NOT NULL,
    quarter TEXT NOT NULL,
    amount REAL NOT NULL,
    payment_date TEXT NOT NULL,
    challan_no TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS invoice_line_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id),
    description TEXT NOT NULL,
    hsn_sac TEXT,
    quantity REAL NOT NULL,
    unit_price REAL NOT NULL,
    amount REAL NOT NULL
  );
`);

// Migrate: add new columns to existing tables
const newColumns = [
  { name: "country", sql: "ALTER TABLE clients ADD COLUMN country TEXT" },
  { name: "from_bank_iban", sql: "ALTER TABLE invoices ADD COLUMN from_bank_iban TEXT" },
  { name: "from_bank_bic", sql: "ALTER TABLE invoices ADD COLUMN from_bank_bic TEXT" },
  { name: "eur_to_inr_rate", sql: "ALTER TABLE invoices ADD COLUMN eur_to_inr_rate REAL" },
  { name: "platform_charges", sql: "ALTER TABLE invoices ADD COLUMN platform_charges REAL" },
  { name: "bank_charges", sql: "ALTER TABLE invoices ADD COLUMN bank_charges REAL" },
  { name: "net_inr_amount", sql: "ALTER TABLE invoices ADD COLUMN net_inr_amount REAL" },
  { name: "paid_date", sql: "ALTER TABLE invoices ADD COLUMN paid_date TEXT" },
  { name: "from_sepa_account_name", sql: "ALTER TABLE invoices ADD COLUMN from_sepa_account_name TEXT" },
  { name: "from_sepa_iban", sql: "ALTER TABLE invoices ADD COLUMN from_sepa_iban TEXT" },
  { name: "from_sepa_bic", sql: "ALTER TABLE invoices ADD COLUMN from_sepa_bic TEXT" },
  { name: "from_sepa_bank", sql: "ALTER TABLE invoices ADD COLUMN from_sepa_bank TEXT" },
  { name: "from_sepa_account_type", sql: "ALTER TABLE invoices ADD COLUMN from_sepa_account_type TEXT" },
  { name: "from_sepa_address", sql: "ALTER TABLE invoices ADD COLUMN from_sepa_address TEXT" },
  { name: "from_swift_account_name", sql: "ALTER TABLE invoices ADD COLUMN from_swift_account_name TEXT" },
  { name: "from_swift_iban", sql: "ALTER TABLE invoices ADD COLUMN from_swift_iban TEXT" },
  { name: "from_swift_bic", sql: "ALTER TABLE invoices ADD COLUMN from_swift_bic TEXT" },
  { name: "from_swift_bank", sql: "ALTER TABLE invoices ADD COLUMN from_swift_bank TEXT" },
  { name: "from_swift_account_type", sql: "ALTER TABLE invoices ADD COLUMN from_swift_account_type TEXT" },
];

for (const col of newColumns) {
  try {
    sqlite.exec(col.sql);
  } catch {
    // Column already exists, ignore
  }
}

export const db = drizzle(sqlite, { schema });
