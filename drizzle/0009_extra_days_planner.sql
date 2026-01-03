CREATE TABLE `extra_day_buckets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL
);--> statement-breakpoint
CREATE TABLE `extra_day_targets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bucket_id` integer NOT NULL REFERENCES `extra_day_buckets`(`id`),
	`name` text NOT NULL,
	`target_type` text NOT NULL,
	`goal_days` real,
	`goal_amount_inr` real,
	`status` text DEFAULT 'active' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`created_at` text NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX `extra_day_target_name_idx` ON `extra_day_targets` (`bucket_id`,`name`);--> statement-breakpoint
CREATE TABLE `extra_day_allocations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bucket_id` integer NOT NULL REFERENCES `extra_day_buckets`(`id`),
	`target_id` integer REFERENCES `extra_day_targets`(`id`),
	`financial_year` text NOT NULL,
	`kind` text NOT NULL,
	`confirmed_date` text NOT NULL,
	`days` real NOT NULL,
	`daily_rate` real,
	`amount_inr` real,
	`notes` text,
	`created_at` text NOT NULL
);
