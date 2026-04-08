-- ============================================================
-- NCV Mail: Followups table + Sent email improvements
-- ============================================================

-- Add reply_to_email_id and recipient columns to emails
ALTER TABLE emails ADD COLUMN IF NOT EXISTS reply_to_email_id integer REFERENCES emails(id) ON DELETE SET NULL;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS recipient text;

-- Create followups table
CREATE TABLE IF NOT EXISTS followups (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_id integer REFERENCES emails(id) ON DELETE SET NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'en_attente' CHECK (status IN ('en_attente', 'relance', 'termine')),
  due_date date,
  notes text,
  ai_suggestion boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS policies for followups
ALTER TABLE followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own followups" ON followups
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own followups" ON followups
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own followups" ON followups
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own followups" ON followups
  FOR DELETE USING (auth.uid() = user_id);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_followups_user_id ON followups(user_id);
CREATE INDEX IF NOT EXISTS idx_followups_email_id ON followups(email_id);
CREATE INDEX IF NOT EXISTS idx_followups_status ON followups(status);
CREATE INDEX IF NOT EXISTS idx_followups_due_date ON followups(due_date);
CREATE INDEX IF NOT EXISTS idx_emails_reply_to ON emails(reply_to_email_id);
CREATE INDEX IF NOT EXISTS idx_emails_status_sent ON emails(status) WHERE status = 'sent';
CREATE INDEX IF NOT EXISTS idx_emails_recipient ON emails(recipient);
