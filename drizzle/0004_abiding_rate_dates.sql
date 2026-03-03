UPDATE OR IGNORE `project_rates`
SET `month_key` = `month_key` || '-01'
WHERE length(`month_key`) = 7;

DELETE FROM `project_rates`
WHERE length(`month_key`) = 7;
