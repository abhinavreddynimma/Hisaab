-- Performance indexes for hot query columns that were previously unindexed.
-- All are additive and safe (IF NOT EXISTS); they speed up the per-account
-- balance walk, bank-row classification lookups, and FY-by-issue-date queries.

CREATE INDEX IF NOT EXISTS `idx_expense_txn_account` ON `expense_transactions` (`account_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_expense_txn_from` ON `expense_transactions` (`from_account_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_expense_txn_to` ON `expense_transactions` (`to_account_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_expense_txn_category` ON `expense_transactions` (`category_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_expense_txn_status` ON `expense_transactions` (`status`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_invoices_issue_date` ON `invoices` (`issue_date`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_bank_entry_date` ON `bank_statement_entries` (`date`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_bank_entry_classified` ON `bank_statement_entries` (`is_classified`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_bank_entry_txn` ON `bank_statement_entries` (`expense_transaction_id`);
