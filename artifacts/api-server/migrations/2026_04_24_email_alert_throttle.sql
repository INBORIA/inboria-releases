-- Anti-spam pour les mails d'alerte "boite deconnectee".
-- Apply via Supabase SQL editor.

ALTER TABLE email_connections
  ADD COLUMN IF NOT EXISTS last_alert_sent_at timestamptz;
