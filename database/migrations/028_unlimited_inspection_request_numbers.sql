-- Allow unlimited IR numbers per month (no 3-digit LPAD truncation after 999).
-- Format remains IR-MON-001 … IR-MON-999, then IR-MON-1000, IR-MON-1001, …

CREATE OR REPLACE FUNCTION generate_inspection_request_number()
RETURNS TEXT AS $$
DECLARE
  current_month TEXT;
  next_number INTEGER;
  seq_text TEXT;
  new_request_number TEXT;
BEGIN
  current_month := UPPER(TO_CHAR(CURRENT_DATE, 'Mon'));

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

  -- Pad to 3 digits only while under 1000; larger counts use the full number.
  IF next_number < 1000 THEN
    seq_text := LPAD(next_number::TEXT, 3, '0');
  ELSE
    seq_text := next_number::TEXT;
  END IF;

  new_request_number := 'IR-' || current_month || '-' || seq_text;

  RETURN new_request_number;
END;
$$ LANGUAGE plpgsql;
