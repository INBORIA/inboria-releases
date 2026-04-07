-- Create project_notes table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS project_notes (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_notes_project_id ON project_notes(project_id);
CREATE INDEX IF NOT EXISTS idx_project_notes_user_id ON project_notes(user_id);

ALTER TABLE project_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own project notes"
  ON project_notes
  FOR SELECT
  USING (user_id = (SELECT id FROM users WHERE supabase_uid = auth.uid()));

CREATE POLICY "Users can insert their own project notes"
  ON project_notes
  FOR INSERT
  WITH CHECK (user_id = (SELECT id FROM users WHERE supabase_uid = auth.uid()));

CREATE POLICY "Users can delete their own project notes"
  ON project_notes
  FOR DELETE
  USING (user_id = (SELECT id FROM users WHERE supabase_uid = auth.uid()));
