DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspection_requests' AND column_name='inspection_date_from') THEN
    ALTER TABLE inspection_requests ADD COLUMN inspection_date_from TIMESTAMP;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspection_requests' AND column_name='inspection_date_to') THEN
    ALTER TABLE inspection_requests ADD COLUMN inspection_date_to TIMESTAMP;
  END IF;

  -- Migrate existing data: copy inspection_datetime to inspection_date_from
  UPDATE inspection_requests
    SET inspection_date_from = inspection_datetime
    WHERE inspection_datetime IS NOT NULL AND inspection_date_from IS NULL;
END $$;
