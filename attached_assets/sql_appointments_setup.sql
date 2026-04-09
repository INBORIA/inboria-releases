CREATE TABLE IF NOT EXISTS appointments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  location text,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  all_day boolean DEFAULT false,
  email_id integer REFERENCES emails(id) ON DELETE SET NULL,
  project_id integer REFERENCES projects(id) ON DELETE SET NULL,
  reminder_minutes integer DEFAULT 30,
  confirmed boolean DEFAULT true,
  participants text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appointments_select_own" ON appointments
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "appointments_insert_own" ON appointments
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "appointments_update_own" ON appointments
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "appointments_delete_own" ON appointments
  FOR DELETE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_appointments_user ON appointments(user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_start ON appointments(start_at);
