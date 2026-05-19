-- Per-row tax exemption flag for non-taxable incomes (gifts, old savings, refunds, etc.)
ALTER TABLE `expense_transactions` ADD COLUMN `exclude_from_tax` integer NOT NULL DEFAULT 0;
