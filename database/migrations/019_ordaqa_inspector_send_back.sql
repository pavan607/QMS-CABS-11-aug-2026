-- ORDAQA assignee (Sections 24–25): send back to designer/initiator with comment
ALTER TABLE inspection_requests ADD COLUMN IF NOT EXISTS ordaqa_inspector_send_back_comment TEXT;
ALTER TABLE inspection_requests ADD COLUMN IF NOT EXISTS ordaqa_inspector_send_back_to VARCHAR(32);
