-- Unified Statement Ingestion Pipeline
-- Phase 1: Raw import model + canonical transaction layer with dedup

CREATE TABLE `statement_imports` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `source` text NOT NULL,
  `file_name` text NOT NULL,
  `original_name` text NOT NULL,
  `file_hash` text NOT NULL,
  `date_range_start` text,
  `date_range_end` text,
  `row_count` integer NOT NULL DEFAULT 0,
  `status` text NOT NULL DEFAULT 'pending',
  `error_message` text,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `statement_imports_file_hash_idx` ON `statement_imports` (`file_hash`);
--> statement-breakpoint

CREATE TABLE `canonical_transactions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `date` text NOT NULL,
  `amount` real NOT NULL,
  `direction` text NOT NULL,
  `normalized_payee` text,
  `reference` text,
  `description` text,
  `category_id` integer REFERENCES `expense_accounts`(`id`),
  `account_id` integer REFERENCES `expense_accounts`(`id`),
  `match_status` text NOT NULL DEFAULT 'unmatched',
  `expense_transaction_id` integer REFERENCES `expense_transactions`(`id`),
  `notes` text,
  `created_at` text NOT NULL
);
--> statement-breakpoint

CREATE TABLE `statement_rows` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `import_id` integer NOT NULL REFERENCES `statement_imports`(`id`),
  `date` text NOT NULL,
  `amount` real NOT NULL,
  `direction` text NOT NULL,
  `balance` real,
  `raw_description` text NOT NULL,
  `normalized_payee` text,
  `reference` text,
  `fingerprint` text NOT NULL,
  `raw_json` text,
  `canonical_transaction_id` integer REFERENCES `canonical_transactions`(`id`),
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `statement_rows_fingerprint_import_idx` ON `statement_rows` (`import_id`, `fingerprint`);
--> statement-breakpoint

CREATE TABLE `canonical_transaction_sources` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `canonical_transaction_id` integer NOT NULL REFERENCES `canonical_transactions`(`id`),
  `statement_row_id` integer NOT NULL REFERENCES `statement_rows`(`id`),
  `match_type` text NOT NULL,
  `confidence` real,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `canonical_source_row_idx` ON `canonical_transaction_sources` (`canonical_transaction_id`, `statement_row_id`);
--> statement-breakpoint

-- Performance indexes
CREATE INDEX `statement_rows_date_idx` ON `statement_rows` (`date`);
--> statement-breakpoint
CREATE INDEX `statement_rows_import_idx` ON `statement_rows` (`import_id`);
--> statement-breakpoint
CREATE INDEX `canonical_txn_date_idx` ON `canonical_transactions` (`date`);
--> statement-breakpoint
CREATE INDEX `canonical_txn_status_idx` ON `canonical_transactions` (`match_status`);
--> statement-breakpoint
CREATE INDEX `canonical_txn_reference_idx` ON `canonical_transactions` (`reference`);
