import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(), // JSON stringified
});

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "viewer"] }).notNull().default("viewer"),
  tag: text("tag"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  uniqueIndex("users_email_idx").on(table.email),
]);

export const sessions = sqliteTable("sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  tokenHash: text("token_hash").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  uniqueIndex("sessions_token_hash_idx").on(table.tokenHash),
]);

export const clients = sqliteTable("clients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  company: text("company"),
  gstin: text("gstin"),
  addressLine1: text("address_line_1"),
  addressLine2: text("address_line_2"),
  city: text("city"),
  state: text("state"),
  pincode: text("pincode"),
  email: text("email"),
  phone: text("phone"),
  country: text("country"),
  currency: text("currency").notNull().default("EUR"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull().references(() => clients.id),
  name: text("name").notNull(),
  defaultDailyRate: real("default_daily_rate").notNull(),
  currency: text("currency").notNull().default("EUR"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const projectRates = sqliteTable("project_rates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull().references(() => projects.id),
  monthKey: text("month_key").notNull(), // "YYYY-MM"
  dailyRate: real("daily_rate").notNull(),
}, (table) => [
  uniqueIndex("project_month_idx").on(table.projectId, table.monthKey),
]);

export const dayEntries = sqliteTable("day_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull().unique(), // "YYYY-MM-DD"
  dayType: text("day_type", {
    enum: ["working", "leave", "holiday", "half_day", "extra_working", "weekend"],
  }).notNull(),
  projectId: integer("project_id").references(() => projects.id),
  notes: text("notes"),
});

export const invoices = sqliteTable("invoices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  invoiceNumber: text("invoice_number").notNull().unique(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  projectId: integer("project_id").references(() => projects.id),
  billingPeriodStart: text("billing_period_start").notNull(),
  billingPeriodEnd: text("billing_period_end").notNull(),
  issueDate: text("issue_date").notNull(),
  dueDate: text("due_date"),
  // From (self) snapshot
  fromName: text("from_name"),
  fromCompany: text("from_company"),
  fromAddress: text("from_address"),
  fromGstin: text("from_gstin"),
  fromPan: text("from_pan"),
  fromEmail: text("from_email"),
  fromPhone: text("from_phone"),
  fromBankName: text("from_bank_name"),
  fromBankAccount: text("from_bank_account"),
  fromBankIfsc: text("from_bank_ifsc"),
  fromBankBranch: text("from_bank_branch"),
  fromBankIban: text("from_bank_iban"),
  fromBankBic: text("from_bank_bic"),
  // SEPA Transfer snapshot
  fromSepaAccountName: text("from_sepa_account_name"),
  fromSepaIban: text("from_sepa_iban"),
  fromSepaBic: text("from_sepa_bic"),
  fromSepaBank: text("from_sepa_bank"),
  fromSepaAccountType: text("from_sepa_account_type"),
  fromSepaAddress: text("from_sepa_address"),
  // SWIFT Transfer snapshot
  fromSwiftAccountName: text("from_swift_account_name"),
  fromSwiftIban: text("from_swift_iban"),
  fromSwiftBic: text("from_swift_bic"),
  fromSwiftBank: text("from_swift_bank"),
  fromSwiftAccountType: text("from_swift_account_type"),
  // To (client) snapshot
  toName: text("to_name"),
  toCompany: text("to_company"),
  toAddress: text("to_address"),
  toGstin: text("to_gstin"),
  toEmail: text("to_email"),
  // Amounts
  subtotal: real("subtotal").notNull().default(0),
  cgstRate: real("cgst_rate").default(0),
  cgstAmount: real("cgst_amount").default(0),
  sgstRate: real("sgst_rate").default(0),
  sgstAmount: real("sgst_amount").default(0),
  igstRate: real("igst_rate").default(0),
  igstAmount: real("igst_amount").default(0),
  total: real("total").notNull().default(0),
  currency: text("currency").notNull().default("EUR"),
  // Status
  status: text("status", { enum: ["draft", "sent", "paid", "cancelled"] }).notNull().default("draft"),
  notes: text("notes"),
  // Payment/conversion fields (populated when marked as paid)
  paidDate: text("paid_date"),
  eurToInrRate: real("eur_to_inr_rate"),
  platformCharges: real("platform_charges"),
  bankCharges: real("bank_charges"),
  netInrAmount: real("net_inr_amount"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const invoiceAttachments = sqliteTable("invoice_attachments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  invoiceId: integer("invoice_id").notNull().references(() => invoices.id),
  fileName: text("file_name").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  label: text("label"), // e.g. "Bank Receipt", "FIRA", "Bank Statement"
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const taxPayments = sqliteTable("tax_payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  financialYear: text("financial_year").notNull(),
  quarter: text("quarter", { enum: ["Q1", "Q2", "Q3", "Q4"] }).notNull(),
  amount: real("amount").notNull(),
  paymentDate: text("payment_date").notNull(),
  challanNo: text("challan_no"),
  notes: text("notes"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const invoiceLineItems = sqliteTable("invoice_line_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  invoiceId: integer("invoice_id").notNull().references(() => invoices.id),
  description: text("description").notNull(),
  hsnSac: text("hsn_sac"),
  quantity: real("quantity").notNull(),
  unitPrice: real("unit_price").notNull(),
  amount: real("amount").notNull(),
});
