-- Add closure features to inspection requests

-- Add closed_date and closed_by fields
ALTER TABLE inspection_requests 
ADD COLUMN IF NOT EXISTS closed_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS closed_by INTEGER REFERENCES users(id);

-- Update status check to include 'closed'
-- Note: PostgreSQL doesn't support modifying CHECK constraints easily,
-- so we'll handle this at the application level

-- Add comment for documentation
COMMENT ON COLUMN inspection_requests.closed_date IS 'Date when the inspection was officially closed after approval';
COMMENT ON COLUMN inspection_requests.closed_by IS 'User who closed the inspection request';


