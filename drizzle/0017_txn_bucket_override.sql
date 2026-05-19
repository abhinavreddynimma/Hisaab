-- Per-transaction bucket override. When set, the expense_transaction counts
-- toward this target bucket regardless of its category's default mapping.
-- When NULL, aggregation falls back to expense_target_accounts.

ALTER TABLE `expense_transactions` ADD COLUMN `bucket_target_id` integer REFERENCES `expense_targets`(`id`);
