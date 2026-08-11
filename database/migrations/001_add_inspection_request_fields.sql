-- Migration: Add inspection request date and update ID format
-- Also link quality checks to inspection requests

-- Add request_date to inspection_requests if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='inspection_requests' AND column_name='request_date'
  ) THEN
    ALTER TABLE inspection_requests 
    ADD COLUMN request_date DATE DEFAULT CURRENT_DATE;
    
    -- Set request_date to created_at date for existing records
    UPDATE inspection_requests 
    SET request_date = DATE(created_at) 
    WHERE request_date IS NULL;
  END IF;
END $$;

-- Add inspection_request_id to quality_checks if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='quality_checks' AND column_name='inspection_request_id'
  ) THEN
    ALTER TABLE quality_checks 
    ADD COLUMN inspection_request_id INTEGER REFERENCES inspection_requests(id) ON DELETE SET NULL;
    
    -- Add index for better performance
    CREATE INDEX IF NOT EXISTS idx_quality_checks_inspection_request 
    ON quality_checks(inspection_request_id);
  END IF;
END $$;

-- Function to generate inspection request number in format IR-MONTH-NUMBER
CREATE OR REPLACE FUNCTION generate_inspection_request_number()
RETURNS TEXT AS $$
DECLARE
  current_month TEXT;
  current_year TEXT;
  next_number INTEGER;
  new_request_number TEXT;
BEGIN
  -- Get current month abbreviation (e.g., 'OCT')
  current_month := UPPER(TO_CHAR(CURRENT_DATE, 'Mon'));
  current_year := TO_CHAR(CURRENT_DATE, 'YY');
  
  -- Get the next sequential number for this month
  SELECT COALESCE(MAX(
    CASE 
      WHEN request_number ~ '^IR-[A-Z]{3}-\d+$' 
      THEN CAST(SUBSTRING(request_number FROM '\d+$') AS INTEGER)
      ELSE 0
    END
  ), 0) + 1
  INTO next_number
  FROM inspection_requests
  WHERE request_number LIKE 'IR-' || current_month || '-%'
    AND EXTRACT(MONTH FROM request_date) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND EXTRACT(YEAR FROM request_date) = EXTRACT(YEAR FROM CURRENT_DATE);
  
  -- Format: IR-OCT-001
  new_request_number := 'IR-' || current_month || '-' || LPAD(next_number::TEXT, 3, '0');
  
  RETURN new_request_number;
END;
$$ LANGUAGE plpgsql;

-- Update existing request_numbers to new format if needed
-- This will update old format to new format for existing records
DO $$
DECLARE
  rec RECORD;
  month_abbr TEXT;
  row_num INTEGER;
BEGIN
  row_num := 1;
  
  FOR rec IN 
    SELECT id, request_date, 
           TO_CHAR(COALESCE(request_date, created_at), 'Mon') as month,
           ROW_NUMBER() OVER (
             PARTITION BY EXTRACT(MONTH FROM COALESCE(request_date, created_at)),
                          EXTRACT(YEAR FROM COALESCE(request_date, created_at))
             ORDER BY created_at
           ) as seq
    FROM inspection_requests
    WHERE request_number NOT LIKE 'IR-%-%'
    ORDER BY created_at
  LOOP
    month_abbr := UPPER(rec.month);
    
    UPDATE inspection_requests
    SET request_number = 'IR-' || month_abbr || '-' || LPAD(rec.seq::TEXT, 3, '0')
    WHERE id = rec.id;
  END LOOP;
END $$;


