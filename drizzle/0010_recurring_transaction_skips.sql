CREATE TABLE `expense_recurring_skips` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recurring_id` integer NOT NULL,
	`month_key` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`recurring_id`) REFERENCES `expense_recurring`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `expense_recurring_skip_month_idx` ON `expense_recurring_skips` (`recurring_id`,`month_key`);
