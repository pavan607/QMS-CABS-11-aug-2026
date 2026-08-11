-- Team Head – QA: send back to initiator/designer with comment
ALTER TABLE inspection_requests ADD COLUMN IF NOT EXISTS qa_approver_send_back_comment TEXT;
ALTER TABLE inspection_requests ADD COLUMN IF NOT EXISTS qa_approver_send_back_to VARCHAR(32);
