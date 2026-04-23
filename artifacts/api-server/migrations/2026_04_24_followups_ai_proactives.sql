-- Relances IA proactives
-- 1) Délai de relance par défaut, configurable par utilisateur (1-60 jours)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS follow_up_delay_days integer NOT NULL DEFAULT 5
  CHECK (follow_up_delay_days >= 1 AND follow_up_delay_days <= 60);

-- 2) Marqueur "Ignorer" pour les suggestions IA, sans toucher au statut
ALTER TABLE public.followups
  ADD COLUMN IF NOT EXISTS dismissed_at timestamptz;

-- 3) Index pour la détection : retrouver vite les mails envoyés sans réponse
CREATE INDEX IF NOT EXISTS emails_user_recipient_created_idx
  ON public.emails (user_id, created_at DESC)
  WHERE recipient IS NOT NULL;

-- 4) Index pour éviter les doublons de suggestion sur un même email
CREATE INDEX IF NOT EXISTS followups_email_ai_idx
  ON public.followups (user_id, email_id)
  WHERE ai_suggestion = true;
