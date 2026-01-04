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
  monthKey: text("month_key").notNull(), // Effective date: "YYYY-MM-DD"
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

export const taxPaymentAttachments = sqliteTable("tax_payment_attachments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  taxPaymentId: integer("tax_payment_id").notNull().references(() => taxPayments.id),
  fileName: text("file_name").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  label: text("label"),
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

// Expense Manager tables
export const expenseAccounts = sqliteTable("expense_accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  type: text("type", { enum: ["income", "expense", "investment", "savings", "bank", "cash"] }).notNull(),
  parentId: integer("parent_id"),
  icon: text("icon"),
  color: text("color"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const expenseTransactions = sqliteTable("expense_transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type", { enum: ["income", "expense", "transfer"] }).notNull(),
  date: text("date").notNull(),
  amount: real("amount").notNull(),
  categoryId: integer("category_id").references(() => expenseAccounts.id),
  accountId: integer("account_id").references(() => expenseAccounts.id),
  fromAccountId: integer("from_account_id").references(() => expenseAccounts.id),
  toAccountId: integer("to_account_id").references(() => expenseAccounts.id),
  fees: real("fees").default(0),
  note: text("note"),
  tags: text("tags"),
  // Source tracking: "manual" (default), "invoice", "bank_statement" (future)
  source: text("source").notNull().default("manual"),
  sourceId: text("source_id"), // e.g. invoice ID, bank statement row ID
  // Status: "confirmed" (default), "estimated" (for sent but unpaid invoices)
  status: text("status", { enum: ["confirmed", "estimated"] }).notNull().default("confirmed"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const expenseBudgets = sqliteTable("expense_budgets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  monthlyAmount: real("monthly_amount").notNull(),
  financialYear: text("financial_year").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const expenseBudgetCategories = sqliteTable("expense_budget_categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  budgetId: integer("budget_id").notNull().references(() => expenseBudgets.id),
  categoryId: integer("category_id").notNull().references(() => expenseAccounts.id),
}, (table) => [
  uniqueIndex("budget_category_idx").on(table.budgetId, table.categoryId),
]);

export const expenseRecurring = sqliteTable("expense_recurring", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  type: text("type", { enum: ["expense", "transfer"] }).notNull().default("expense"),
  amount: real("amount").notNull(),
  categoryId: integer("category_id").references(() => expenseAccounts.id),
  accountId: integer("account_id").references(() => expenseAccounts.id),
  fromAccountId: integer("from_account_id").references(() => expenseAccounts.id),
  toAccountId: integer("to_account_id").references(() => expenseAccounts.id),
  frequency: text("frequency", { enum: ["monthly", "quarterly", "yearly"] }).notNull().default("monthly"),
  dayOfMonth: integer("day_of_month").notNull().default(1), // 1-28
  startDate: text("start_date").notNull(), // "YYYY-MM-DD"
  endDate: text("end_date"), // null = ongoing
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const expenseRecurringSkips = sqliteTable("expense_recurring_skips", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  recurringId: integer("recurring_id").notNull().references(() => expenseRecurring.id),
  monthKey: text("month_key").notNull(), // "YYYY-MM"
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  uniqueIndex("expense_recurring_skip_month_idx").on(table.recurringId, table.monthKey),
]);

export const expenseTargets = sqliteTable("expense_targets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  monthlyAmount: real("monthly_amount").notNull(),
  financialYear: text("financial_year").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const expenseTargetAccounts = sqliteTable("expense_target_accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  targetId: integer("target_id").notNull().references(() => expenseTargets.id),
  accountId: integer("account_id").notNull().references(() => expenseAccounts.id),
}, (table) => [
  uniqueIndex("target_account_idx").on(table.targetId, table.accountId),
]);

export const extraDayBuckets = sqliteTable("extra_day_buckets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const extraDayTargets = sqliteTable("extra_day_targets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bucketId: integer("bucket_id").notNull().references(() => extraDayBuckets.id),
  name: text("name").notNull(),
  targetType: text("target_type", { enum: ["day", "money"] }).notNull(),
  goalDays: real("goal_days"),
  goalAmountInr: real("goal_amount_inr"),
  status: text("status", { enum: ["active", "completed", "archived"] }).notNull().default("active"),
  sortOrder: integer("sort_order").notNull().default(0),
  notes: text("notes"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  uniqueIndex("extra_day_target_name_idx").on(table.bucketId, table.name),
]);

// === Unified Statement Ingestion Pipeline ===

export const statementImports = sqliteTable("statement_imports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  source: text("source", { enum: ["sbi", "phonepe", "hdfc", "icici", "card", "other"] }).notNull(),
  fileName: text("file_name").notNull(),
  originalName: text("original_name").notNull(),
  fileHash: text("file_hash").notNull(), // SHA-256 of file content for re-import detection
  dateRangeStart: text("date_range_start"), // earliest transaction date in file
  dateRangeEnd: text("date_range_end"), // latest transaction date in file
  rowCount: integer("row_count").notNull().default(0),
  status: text("status", { enum: ["pending", "processing", "completed", "failed"] }).notNull().default("pending"),
  errorMessage: text("error_message"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  uniqueIndex("statement_imports_file_hash_idx").on(table.fileHash),
]);

export const statementRows = sqliteTable("statement_rows", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  importId: integer("import_id").notNull().references(() => statementImports.id),
  // Normalized fields (every source maps into these)
  date: text("date").notNull(), // "YYYY-MM-DD"
  amount: real("amount").notNull(), // always positive
  direction: text("direction", { enum: ["credit", "debit"] }).notNull(),
  balance: real("balance"), // running balance if available
  rawDescription: text("raw_description").notNull(),
  normalizedPayee: text("normalized_payee"), // cleaned up counterparty name
  reference: text("reference"), // UTR, transaction ID, cheque number
  // Fingerprint for dedup
  fingerprint: text("fingerprint").notNull(), // hash of (date + amount + direction + reference/description)
  // Source-specific raw data preserved as JSON
  rawJson: text("raw_json"), // full original row for auditability
  // Linking
  canonicalTransactionId: integer("canonical_transaction_id").references(() => canonicalTransactions.id),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  uniqueIndex("statement_rows_fingerprint_import_idx").on(table.importId, table.fingerprint),
]);

export const canonicalTransactions = sqliteTable("canonical_transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(), // "YYYY-MM-DD"
  amount: real("amount").notNull(), // always positive
  direction: text("direction", { enum: ["credit", "debit"] }).notNull(),
  normalizedPayee: text("normalized_payee"),
  reference: text("reference"), // best available UTR/txn ID across sources
  description: text("description"), // merged/best description
  // Categorization (linked to expense system)
  categoryId: integer("category_id").references(() => expenseAccounts.id),
  accountId: integer("account_id").references(() => expenseAccounts.id),
  // Matching status
  matchStatus: text("match_status", {
    enum: ["auto_matched", "manual_matched", "unmatched", "review", "ignored"],
  }).notNull().default("unmatched"),
  // Link to expense_transactions once synced
  expenseTransactionId: integer("expense_transaction_id").references(() => expenseTransactions.id),
  notes: text("notes"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const canonicalTransactionSources = sqliteTable("canonical_transaction_sources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  canonicalTransactionId: integer("canonical_transaction_id").notNull().references(() => canonicalTransactions.id),
  statementRowId: integer("statement_row_id").notNull().references(() => statementRows.id),
  matchType: text("match_type", { enum: ["exact", "strong", "fuzzy", "manual"] }).notNull(),
  confidence: real("confidence"), // 0-1 score for non-exact matches
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  uniqueIndex("canonical_source_row_idx").on(table.canonicalTransactionId, table.statementRowId),
]);

export const extraDayAllocations = sqliteTable("extra_day_allocations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bucketId: integer("bucket_id").notNull().references(() => extraDayBuckets.id),
  targetId: integer("target_id").references(() => extraDayTargets.id),
  financialYear: text("financial_year").notNull(),
  kind: text("kind", { enum: ["day", "money"] }).notNull(),
  confirmedDate: text("confirmed_date").notNull(),
  days: real("days").notNull(),
  dailyRate: real("daily_rate"),
  amountInr: real("amount_inr"),
  notes: text("notes"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});
