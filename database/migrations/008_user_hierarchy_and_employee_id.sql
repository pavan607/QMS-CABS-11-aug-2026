-- Migration: Add employee_id, designation, reporting hierarchy, scientist rank to users

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='employee_id') THEN
    ALTER TABLE users ADD COLUMN employee_id VARCHAR(50) UNIQUE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='designation') THEN
    ALTER TABLE users ADD COLUMN designation VARCHAR(50);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='scientist_rank') THEN
    ALTER TABLE users ADD COLUMN scientist_rank VARCHAR(50);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='reporting_to') THEN
    ALTER TABLE users ADD COLUMN reporting_to INTEGER REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_employee_id ON users(employee_id);
CREATE INDEX IF NOT EXISTS idx_users_designation ON users(designation);
CREATE INDEX IF NOT EXISTS idx_users_reporting_to ON users(reporting_to);

-- Seed employee_ids for existing users
UPDATE users SET employee_id = 'ADM001' WHERE email = 'admin@qms.com' AND employee_id IS NULL;
UPDATE users SET employee_id = 'INS001' WHERE email = 'inspector@qms.com' AND employee_id IS NULL;
UPDATE users SET employee_id = 'APR001' WHERE email = 'approver@qms.com' AND employee_id IS NULL;
UPDATE users SET employee_id = 'INI001' WHERE email = 'initiator@qms.com' AND employee_id IS NULL;
