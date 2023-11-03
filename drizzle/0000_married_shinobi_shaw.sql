CREATE TABLE `clients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`company` text,
	`gstin` text,
	`address_line_1` text,
	`address_line_2` text,
	`city` text,
	`state` text,
	`pincode` text,
	`email` text,
	`phone` text,
	`country` text,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `day_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`day_type` text NOT NULL,
	`project_id` integer,
	`notes` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `day_entries_date_unique` ON `day_entries` (`date`);--> statement-breakpoint
CREATE TABLE `invoice_attachments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`invoice_id` integer NOT NULL,
	`file_name` text NOT NULL,
	`original_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`file_size` integer NOT NULL,
	`label` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `invoice_line_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`invoice_id` integer NOT NULL,
	`description` text NOT NULL,
	`hsn_sac` text,
	`quantity` real NOT NULL,
	`unit_price` real NOT NULL,
	`amount` real NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`invoice_number` text NOT NULL,
	`client_id` integer NOT NULL,
	`project_id` integer,
	`billing_period_start` text NOT NULL,
	`billing_period_end` text NOT NULL,
	`issue_date` text NOT NULL,
	`due_date` text,
	`from_name` text,
	`from_company` text,
	`from_address` text,
	`from_gstin` text,
	`from_pan` text,
	`from_email` text,
	`from_phone` text,
	`from_bank_name` text,
	`from_bank_account` text,
	`from_bank_ifsc` text,
	`from_bank_branch` text,
	`from_bank_iban` text,
	`from_bank_bic` text,
	`from_sepa_account_name` text,
	`from_sepa_iban` text,
	`from_sepa_bic` text,
	`from_sepa_bank` text,
	`from_sepa_account_type` text,
	`from_sepa_address` text,
	`from_swift_account_name` text,
	`from_swift_iban` text,
	`from_swift_bic` text,
	`from_swift_bank` text,
	`from_swift_account_type` text,
	`to_name` text,
	`to_company` text,
	`to_address` text,
	`to_gstin` text,
	`to_email` text,
	`subtotal` real DEFAULT 0 NOT NULL,
	`cgst_rate` real DEFAULT 0,
	`cgst_amount` real DEFAULT 0,
	`sgst_rate` real DEFAULT 0,
	`sgst_amount` real DEFAULT 0,
	`igst_rate` real DEFAULT 0,
	`igst_amount` real DEFAULT 0,
	`total` real DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`notes` text,
	`paid_date` text,
	`eur_to_inr_rate` real,
	`platform_charges` real,
	`bank_charges` real,
	`net_inr_amount` real,
	`created_at` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_invoice_number_unique` ON `invoices` (`invoice_number`);--> statement-breakpoint
CREATE TABLE `project_rates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`month_key` text NOT NULL,
	`daily_rate` real NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_month_idx` ON `project_rates` (`project_id`,`month_key`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`name` text NOT NULL,
	`default_daily_rate` real NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tax_payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`financial_year` text NOT NULL,
	`quarter` text NOT NULL,
	`amount` real NOT NULL,
	`payment_date` text NOT NULL,
	`challan_no` text,
	`notes` text,
	`created_at` text NOT NULL
);
