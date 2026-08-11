-- Allow users without an email (login uses employee_id).
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
