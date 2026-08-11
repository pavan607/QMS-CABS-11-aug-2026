-- Migration: Add inspection type groups and items tables

-- Inspection Type Groups
CREATE TABLE IF NOT EXISTS inspection_type_groups (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inspection Type Items (linked to groups)
CREATE TABLE IF NOT EXISTS inspection_type_items (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES inspection_type_groups(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(100) NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(group_id, code)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_inspection_type_groups_status ON inspection_type_groups(status);
CREATE INDEX IF NOT EXISTS idx_inspection_type_items_group ON inspection_type_items(group_id);
CREATE INDEX IF NOT EXISTS idx_inspection_type_items_code ON inspection_type_items(code);
CREATE INDEX IF NOT EXISTS idx_inspection_type_items_status ON inspection_type_items(status);

-- Seed default groups and items from existing hardcoded values
INSERT INTO inspection_type_groups (name, description, sort_order) VALUES
  ('General', 'General purpose inspection types', 1),
  ('Safety & Compliance', 'Safety and regulatory compliance inspections', 2)
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  general_id INTEGER;
  safety_id INTEGER;
BEGIN
  SELECT id INTO general_id FROM inspection_type_groups WHERE name = 'General' LIMIT 1;
  SELECT id INTO safety_id FROM inspection_type_groups WHERE name = 'Safety & Compliance' LIMIT 1;

  IF general_id IS NOT NULL THEN
    INSERT INTO inspection_type_items (group_id, name, code, sort_order) VALUES
      (general_id, 'Routine', 'routine', 1),
      (general_id, 'Follow-up', 'follow-up', 2),
      (general_id, 'Emergency', 'emergency', 3)
    ON CONFLICT (group_id, code) DO NOTHING;
  END IF;

  IF safety_id IS NOT NULL THEN
    INSERT INTO inspection_type_items (group_id, name, code, sort_order) VALUES
      (safety_id, 'Compliance', 'compliance', 1),
      (safety_id, 'Safety', 'safety', 2)
    ON CONFLICT (group_id, code) DO NOTHING;
  END IF;
END $$;
