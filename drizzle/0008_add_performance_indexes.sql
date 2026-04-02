CREATE INDEX IF NOT EXISTS `idx_expense_txn_date` ON `expense_transactions` (`date`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_expense_txn_source` ON `expense_transactions` (`source`, `source_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_invoices_status` ON `invoices` (`status`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_invoices_paid_date` ON `invoices` (`paid_date`);
