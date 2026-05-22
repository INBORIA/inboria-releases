-- Table `notifications` — centre de notifs in-app (page /dashboard/notifications
-- + icône 🔔 sidebar). Référencée depuis longtemps par `routes/notifications.ts`
-- et `lib/activity.ts` (createNotification) mais la table n'avait jamais été
-- créée côté Supabase, donc tous les INSERT échouaient silencieusement
-- (code ne checke pas `error` retourné par supabase-js).
--
-- Types attendus (string libre, pas de CHECK pour rester extensible) :
--   - email_reply_received       (Phase 2 — auto-sync detect reply)
--   - send_failed                (Phase 2 — /emails/send catch)
--   - followup_suggestions_digest (Phase 2 — follow-up-detector)
--   - appointment_imminent       (Phase 2 — appointment-reminder-worker)
--   - team_*, system_*, inboria_* (futurs)

CREATE TABLE IF NOT EXISTS public.notifications (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text,
  email_id integer REFERENCES public.emails(id) ON DELETE SET NULL,
  triggered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index principal : liste user_id ORDER BY created_at DESC LIMIT 30
CREATE INDEX IF NOT EXISTS notifications_user_created_at_idx
  ON public.notifications (user_id, created_at DESC);

-- Index unread-count (filtre partiel) — utilisé par GET /notifications/unread-count
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications (user_id)
  WHERE read = false;

-- Dedup appointment_imminent (worker fait un SELECT par tag [apt:UUID])
CREATE INDEX IF NOT EXISTS notifications_user_type_created_at_idx
  ON public.notifications (user_id, type, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own
  ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
CREATE POLICY notifications_update_own
  ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id);
