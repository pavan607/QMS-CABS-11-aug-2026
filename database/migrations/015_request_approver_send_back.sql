-- Comment shown to initiator when Request Approver sends IR back for Part I corrections (non-terminal).
ALTER TABLE inspection_requests ADD COLUMN IF NOT EXISTS request_approver_send_back_comment TEXT;
