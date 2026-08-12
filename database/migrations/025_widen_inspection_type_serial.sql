-- Allow long multi-select Part I values (inspection stages / serial numbers).
-- inspection_type is mirrored from inspection_stage on create and exceeded VARCHAR(100).

ALTER TABLE inspection_requests
  ALTER COLUMN inspection_type TYPE TEXT;

ALTER TABLE inspection_requests
  ALTER COLUMN serial_number TYPE TEXT;
