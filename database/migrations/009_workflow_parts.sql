-- Migration: Add multi-part workflow fields for CABS IR format
-- Part I: Initiator fills, Request Approver approves (Section 21)
-- Part II: QA Approver assigns inspector, option to forward to ORDAQA
-- Part III: Inspector observations/findings
-- Part IV: Final inspection results

-- Request Approver fields (Part I approval)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspection_requests' AND column_name='request_approver_id') THEN
    ALTER TABLE inspection_requests ADD COLUMN request_approver_id INTEGER REFERENCES users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspection_requests' AND column_name='request_approval_date') THEN
    ALTER TABLE inspection_requests ADD COLUMN request_approval_date TIMESTAMP;
  END IF;
END $$;

-- Part II: QA Approver fields
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspection_requests' AND column_name='qa_approver_id') THEN
    ALTER TABLE inspection_requests ADD COLUMN qa_approver_id INTEGER REFERENCES users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspection_requests' AND column_name='forwarded_to_ordaqa') THEN
    ALTER TABLE inspection_requests ADD COLUMN forwarded_to_ordaqa BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspection_requests' AND column_name='part2_notes') THEN
    ALTER TABLE inspection_requests ADD COLUMN part2_notes TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspection_requests' AND column_name='part2_date') THEN
    ALTER TABLE inspection_requests ADD COLUMN part2_date TIMESTAMP;
  END IF;
END $$;

-- ORDAQA Inspector (separate from R&QA inspector)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspection_requests' AND column_name='ordaqa_inspector_id') THEN
    ALTER TABLE inspection_requests ADD COLUMN ordaqa_inspector_id INTEGER REFERENCES users(id);
  END IF;
END $$;

-- Part III: Inspector observations (JSONB for flexible data)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspection_requests' AND column_name='part3_data') THEN
    ALTER TABLE inspection_requests ADD COLUMN part3_data JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspection_requests' AND column_name='part3_completed_by') THEN
    ALTER TABLE inspection_requests ADD COLUMN part3_completed_by INTEGER REFERENCES users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspection_requests' AND column_name='part3_date') THEN
    ALTER TABLE inspection_requests ADD COLUMN part3_date TIMESTAMP;
  END IF;
END $$;

-- Part IV: Final inspection results (JSONB for flexible data)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspection_requests' AND column_name='part4_data') THEN
    ALTER TABLE inspection_requests ADD COLUMN part4_data JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspection_requests' AND column_name='part4_completed_by') THEN
    ALTER TABLE inspection_requests ADD COLUMN part4_completed_by INTEGER REFERENCES users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspection_requests' AND column_name='part4_date') THEN
    ALTER TABLE inspection_requests ADD COLUMN part4_date TIMESTAMP;
  END IF;
END $$;

-- Final QA approval fields
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspection_requests' AND column_name='final_qa_approver_id') THEN
    ALTER TABLE inspection_requests ADD COLUMN final_qa_approver_id INTEGER REFERENCES users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspection_requests' AND column_name='final_qa_approval_date') THEN
    ALTER TABLE inspection_requests ADD COLUMN final_qa_approval_date TIMESTAMP;
  END IF;
END $$;

-- ORDAQA final approval fields
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspection_requests' AND column_name='ordaqa_approver_id') THEN
    ALTER TABLE inspection_requests ADD COLUMN ordaqa_approver_id INTEGER REFERENCES users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspection_requests' AND column_name='ordaqa_approval_date') THEN
    ALTER TABLE inspection_requests ADD COLUMN ordaqa_approval_date TIMESTAMP;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ir_request_approver ON inspection_requests(request_approver_id);
CREATE INDEX IF NOT EXISTS idx_ir_qa_approver ON inspection_requests(qa_approver_id);
CREATE INDEX IF NOT EXISTS idx_ir_ordaqa_inspector ON inspection_requests(ordaqa_inspector_id);
CREATE INDEX IF NOT EXISTS idx_ir_forwarded_ordaqa ON inspection_requests(forwarded_to_ordaqa);
