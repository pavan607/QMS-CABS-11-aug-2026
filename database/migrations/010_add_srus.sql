-- Migration: Add SRUs (Shop Replaceable Units) table under LRUs

CREATE TABLE IF NOT EXISTS srus (
  id SERIAL PRIMARY KEY,
  lru_id INTEGER NOT NULL REFERENCES lrus(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  part_number VARCHAR(100),
  description TEXT,
  status VARCHAR(20) DEFAULT 'active',
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(lru_id, code)
);

CREATE INDEX IF NOT EXISTS idx_srus_lru ON srus(lru_id);
CREATE INDEX IF NOT EXISTS idx_srus_code ON srus(code);
CREATE INDEX IF NOT EXISTS idx_srus_part_number ON srus(part_number);

-- Link inspection requests to SRUs
ALTER TABLE inspection_requests ADD COLUMN IF NOT EXISTS sru_id INTEGER REFERENCES srus(id) ON DELETE SET NULL;
