-- Per-transaction modification flag. When set, the row represents an
-- opening-balance / one-off adjustment that affects per-account balances
-- but is excluded from monthly income / expense / net statistics.

ALTER TABLE `expense_transactions` ADD COLUMN `is_modification` integer NOT NULL DEFAULT 0;
