-- Suivi de la santé des connexions e-mail (compteur d'echecs et derniere erreur).
-- Apply via Supabase SQL editor.

ALTER TABLE email_connections
  ADD COLUMN IF NOT EXISTS consecutive_failures integer NOT NULL DEFAULT 0;

ALTER TABLE email_connections
  ADD COLUMN IF NOT EXISTS last_error_at timestamptz;

ALTER TABLE email_connections
  ADD COLUMN IF NOT EXISTS last_error_message text;

CREATE INDEX IF NOT EXISTS idx_email_connections_failing
  ON email_connections(user_id)
  WHERE consecutive_failures > 0;
