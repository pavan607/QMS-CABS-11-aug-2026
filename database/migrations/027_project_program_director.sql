-- Link each project to the Program Director (PGD) the programme relates to.
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS program_director_id INTEGER REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_projects_program_director ON projects(program_director_id);
