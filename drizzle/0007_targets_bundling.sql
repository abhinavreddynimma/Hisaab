ALTER TABLE `expense_targets` ADD `name` text NOT NULL DEFAULT 'Target';--> statement-breakpoint
CREATE TABLE `expense_target_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`target_id` integer NOT NULL REFERENCES `expense_targets`(`id`),
	`account_id` integer NOT NULL REFERENCES `expense_accounts`(`id`)
);--> statement-breakpoint
CREATE UNIQUE INDEX `target_account_idx` ON `expense_target_accounts` (`target_id`,`account_id`);--> statement-breakpoint
-- Migrate existing single-account targets to the new join table
INSERT INTO `expense_target_accounts` (`target_id`, `account_id`)
SELECT `id`, `account_id` FROM `expense_targets` WHERE `account_id` IS NOT NULL;--> statement-breakpoint
-- Copy account name as the target name for existing targets
UPDATE `expense_targets` SET `name` = (
  SELECT `name` FROM `expense_accounts` WHERE `expense_accounts`.`id` = `expense_targets`.`account_id`
) WHERE `account_id` IS NOT NULL;
