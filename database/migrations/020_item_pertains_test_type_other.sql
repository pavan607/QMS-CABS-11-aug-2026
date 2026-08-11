-- Free text when "Other" is selected for Unit Type or Test Type (field 3)
ALTER TABLE inspection_requests ADD COLUMN IF NOT EXISTS item_pertains_to_other TEXT;
ALTER TABLE inspection_requests ADD COLUMN IF NOT EXISTS test_type_other TEXT;
