-- Budget planner line items for the /budget page. Each row is a planned
-- monthly allocation tagged expense / savings / investment, compared against
-- the 30 / 20 / 50 target split. Income is derived from real receipts, not
-- stored here.

CREATE TABLE `budget_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`amount` real NOT NULL,
	`category` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
