-- Migration 013: Two-step Part 2 workflow
-- Adds nominated_team_head_id (QA Head nominates a Team Head - QA)
-- Adds inspector_ids (Team Head assigns multiple inspectors)

ALTER TABLE inspection_requests
  ADD COLUMN IF NOT EXISTS nominated_team_head_id INTEGER REFERENCES users(id);

ALTER TABLE inspection_requests
  ADD COLUMN IF NOT EXISTS inspector_ids TEXT DEFAULT '[]';
