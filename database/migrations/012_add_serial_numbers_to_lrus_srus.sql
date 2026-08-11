-- Add serial_numbers column to lrus and srus tables (stored as JSON array of strings)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lrus' AND column_name='serial_numbers') THEN
    ALTER TABLE lrus ADD COLUMN serial_numbers TEXT DEFAULT '[]';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='srus' AND column_name='serial_numbers') THEN
    ALTER TABLE srus ADD COLUMN serial_numbers TEXT DEFAULT '[]';
  END IF;
END $$;
