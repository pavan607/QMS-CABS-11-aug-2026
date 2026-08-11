-- Part I field 4: R&QA / DGAQA involvement flags for the inspection
ALTER TABLE inspection_requests
  ADD COLUMN IF NOT EXISTS so_involves_dgaqa BOOLEAN DEFAULT FALSE;

ALTER TABLE inspection_requests
  ADD COLUMN IF NOT EXISTS so_involves_rqa BOOLEAN DEFAULT FALSE;
