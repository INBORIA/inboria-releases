-- Synchronisation du dossier Indésirables du fournisseur (Outlook Graph + IMAP \Junk).
-- Apply via Supabase SQL editor.

ALTER TABLE emails ADD COLUMN IF NOT EXISTS spam_source text;
ALTER TABLE emails DROP CONSTRAINT IF EXISTS emails_spam_source_check;
ALTER TABLE emails ADD CONSTRAINT emails_spam_source_check
  CHECK (spam_source IS NULL OR spam_source IN ('provider','ai','user'));

ALTER TABLE emails ADD COLUMN IF NOT EXISTS provider_message_id text;
CREATE INDEX IF NOT EXISTS idx_emails_user_provider_msgid
  ON emails(user_id, provider_message_id)
  WHERE provider_message_id IS NOT NULL;

ALTER TABLE email_connections ADD COLUMN IF NOT EXISTS junk_folder_path text;
