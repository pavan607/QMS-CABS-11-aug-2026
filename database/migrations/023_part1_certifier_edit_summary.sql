-- Store last Part I field-change summary when nominated Request Approver / DH certifier edits Part I
ALTER TABLE inspection_requests
  ADD COLUMN IF NOT EXISTS part1_certifier_edit_summary TEXT;
