-- Fix quality check result values to be consistent
-- Change 'pass' to 'passed' and 'fail' to 'failed'

UPDATE quality_checks 
SET result = 'passed' 
WHERE result = 'pass';

UPDATE quality_checks 
SET result = 'failed' 
WHERE result = 'fail';

-- Add a comment to document the change
COMMENT ON COLUMN quality_checks.result IS 'Quality check result: pending, passed, or failed';

