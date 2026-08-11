-- Migration: Add projects, subsystems, and LRUs tables with hierarchical linking

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'active',
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Subsystems table (linked to projects)
CREATE TABLE IF NOT EXISTS subsystems (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'active',
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, code)
);

-- LRUs table (linked to subsystems)
CREATE TABLE IF NOT EXISTS lrus (
  id SERIAL PRIMARY KEY,
  subsystem_id INTEGER NOT NULL REFERENCES subsystems(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  part_number VARCHAR(100),
  description TEXT,
  status VARCHAR(20) DEFAULT 'active',
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(subsystem_id, code)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_code ON projects(code);
CREATE INDEX IF NOT EXISTS idx_subsystems_project ON subsystems(project_id);
CREATE INDEX IF NOT EXISTS idx_subsystems_code ON subsystems(code);
CREATE INDEX IF NOT EXISTS idx_lrus_subsystem ON lrus(subsystem_id);
CREATE INDEX IF NOT EXISTS idx_lrus_code ON lrus(code);
CREATE INDEX IF NOT EXISTS idx_lrus_part_number ON lrus(part_number);
