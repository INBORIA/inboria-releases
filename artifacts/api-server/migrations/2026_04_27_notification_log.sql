-- Trace les notifications externes envoyées par Inboria vers les outils de
-- collaboration (Slack, Notion). Sert exclusivement au filtre « Collaboration »
-- de la Réception : « afficher uniquement les emails qui ont déjà déclenché
-- une notif vers Slack / Notion ». Aucun PII de message stocké — on garde
-- l'ID de l'email d'origine + le provider + le statut + l'horodatage.
--
-- email_id est NULLable + ON DELETE SET NULL : on conserve l'historique des
-- notifs même si l'email est purgé (soft-delete RGPD ou vraie suppression).
-- L'index composite (user_id, provider, email_id) sert le sous-select du
-- filtre Réception. L'index (user_id, sent_at desc) sert un futur écran
-- d'historique éventuel.

CREATE TABLE IF NOT EXISTS public.notification_log (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_id integer REFERENCES public.emails(id) ON DELETE SET NULL,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  channel_id text,
  channel_name text,
  error_message text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_log_provider_check CHECK (provider IN ('slack', 'notion')),
  CONSTRAINT notification_log_status_check CHECK (status IN ('sent', 'failed'))
);

-- Index principal : sert exactement la sous-requête du filtre Réception
-- (WHERE user_id = ? AND provider = ? AND status = 'sent' AND email_id IS NOT NULL
--  ORDER BY sent_at DESC LIMIT 5000). On inclut email_id en payload pour
-- transformer la lecture en index-only scan (PostgreSQL 11+).
CREATE INDEX IF NOT EXISTS notification_log_user_provider_status_sent_at_idx
  ON public.notification_log (user_id, provider, status, sent_at DESC)
  INCLUDE (email_id);

-- Index secondaire : navigation par email (jointure inverse éventuelle).
CREATE INDEX IF NOT EXISTS notification_log_user_email_idx
  ON public.notification_log (user_id, email_id)
  WHERE email_id IS NOT NULL;

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notification_log_select_own ON public.notification_log;
CREATE POLICY notification_log_select_own
  ON public.notification_log
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS notification_log_insert_own ON public.notification_log;
CREATE POLICY notification_log_insert_own
  ON public.notification_log
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
