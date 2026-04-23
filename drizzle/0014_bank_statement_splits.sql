CREATE TABLE `bank_statement_splits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bank_statement_entry_id` integer NOT NULL,
	`expense_transaction_id` integer NOT NULL,
	`expense_name` text NOT NULL,
	`amount` real NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`bank_statement_entry_id`) REFERENCES `bank_statement_entries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`expense_transaction_id`) REFERENCES `expense_transactions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bank_statement_split_tx_idx` ON `bank_statement_splits` (`expense_transaction_id`);
