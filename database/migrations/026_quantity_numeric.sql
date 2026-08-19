-- Part I field 11. Qty and field 10 Qty/set may include a decimal (e.g. 2.5).
ALTER TABLE inspection_requests
  ALTER COLUMN quantity TYPE NUMERIC(14, 4) USING quantity::numeric;

ALTER TABLE inspection_requests
  ALTER COLUMN quantity_per_set TYPE NUMERIC(14, 4) USING quantity_per_set::numeric;
