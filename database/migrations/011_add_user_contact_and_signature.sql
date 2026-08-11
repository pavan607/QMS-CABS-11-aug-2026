-- Add contact_number and signature_path columns to users table
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='contact_number') THEN
    ALTER TABLE users ADD COLUMN contact_number VARCHAR(20);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='signature_path') THEN
    ALTER TABLE users ADD COLUMN signature_path VARCHAR(500);
  END IF;
END $$;
