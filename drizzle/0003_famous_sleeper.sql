CREATE TABLE `tax_payment_attachments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tax_payment_id` integer NOT NULL,
	`file_name` text NOT NULL,
	`original_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`file_size` integer NOT NULL,
	`label` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`tax_payment_id`) REFERENCES `tax_payments`(`id`) ON UPDATE no action ON DELETE no action
);
