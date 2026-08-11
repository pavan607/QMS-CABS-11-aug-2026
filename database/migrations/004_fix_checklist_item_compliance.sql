-- Migration to fix checklist items with passed status but incorrect is_compliant value
-- Date: October 22, 2025

-- Update all checklist items that have status = 'passed' but is_compliant is NULL or false
-- These are items that were auto-completed but the is_compliant field was not set properly
UPDATE checklist_items
SET is_compliant = true,
    updated_at = CURRENT_TIMESTAMP
WHERE status = 'passed' 
  AND (is_compliant IS NULL OR is_compliant = false);

-- Update all checklist items that have status = 'failed' to ensure is_compliant is false
UPDATE checklist_items
SET is_compliant = false,
    updated_at = CURRENT_TIMESTAMP
WHERE status = 'failed' 
  AND (is_compliant IS NULL OR is_compliant = true);

-- Set is_compliant to NULL for pending and N/A items
UPDATE checklist_items
SET is_compliant = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE status IN ('pending', 'na') 
  AND is_compliant IS NOT NULL;

