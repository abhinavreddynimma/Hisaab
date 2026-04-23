CREATE TABLE IF NOT EXISTS `reminders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`month_key` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`metadata` text,
	`created_at` text NOT NULL,
	`dismissed_at` text
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `reminder_type_month_idx` ON `reminders` (`type`,`month_key`);
