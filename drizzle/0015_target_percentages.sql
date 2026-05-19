-- Percentage-based, nested expense targets
-- Adds optional fields so a target can represent "X% of parent" instead of a fixed monthly amount.

ALTER TABLE `expense_targets` ADD COLUMN `percentage` real;
--> statement-breakpoint
ALTER TABLE `expense_targets` ADD COLUMN `parent_target_id` integer REFERENCES `expense_targets`(`id`);
