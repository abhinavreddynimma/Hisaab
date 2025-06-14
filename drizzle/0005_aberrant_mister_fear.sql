ALTER TABLE `expense_transactions` ADD `source` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `expense_transactions` ADD `source_id` text;--> statement-breakpoint
ALTER TABLE `expense_transactions` ADD `status` text DEFAULT 'confirmed' NOT NULL;