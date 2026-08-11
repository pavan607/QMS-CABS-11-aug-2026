-- Initiator-selected DH/DGD Request Approver (field 21); drives visibility, notify, and forward permission.
ALTER TABLE inspection_requests ADD COLUMN IF NOT EXISTS nominated_request_approver_id INTEGER REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_ir_nominated_ra ON inspection_requests(nominated_request_approver_id);
