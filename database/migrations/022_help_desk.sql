-- Help Desk: definitions (e.g. flight critical), guidelines, and reference uploads

CREATE TABLE IF NOT EXISTS help_desk_resources (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  content TEXT,
  category VARCHAR(50) NOT NULL DEFAULT 'guideline',
  file_name VARCHAR(255),
  file_path VARCHAR(500),
  file_type VARCHAR(100),
  file_size INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT help_desk_resources_category_check
    CHECK (category IN ('definition', 'guideline', 'procedure', 'reference')),
  CONSTRAINT help_desk_resources_status_check
    CHECK (status IN ('active', 'archived'))
);

CREATE INDEX IF NOT EXISTS idx_help_desk_resources_category
  ON help_desk_resources(category);

CREATE INDEX IF NOT EXISTS idx_help_desk_resources_status
  ON help_desk_resources(status);

CREATE INDEX IF NOT EXISTS idx_help_desk_resources_created_at
  ON help_desk_resources(created_at DESC);
