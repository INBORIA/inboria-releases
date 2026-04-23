-- Empeche les doublons de mails synchronises depuis le fournisseur (Gmail/Outlook/IMAP)
-- en cas de syncs concurrents (INBOX + Indesirables / multi-runners).
-- Le check applicatif via Message-ID reste, cette contrainte est la ceinture-et-bretelles.
--
-- A appliquer dans Supabase > SQL Editor.
-- Idempotent : peut etre execute plusieurs fois sans risque.

CREATE UNIQUE INDEX IF NOT EXISTS emails_user_provider_message_uniq
  ON public.emails (user_id, provider_message_id)
  WHERE provider_message_id IS NOT NULL;

-- Verification :
-- SELECT indexname FROM pg_indexes WHERE tablename = 'emails' AND indexname = 'emails_user_provider_message_uniq';
