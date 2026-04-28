-- =====================================================================
-- Nettoyage des suggestions de relance IA pour mails NON envoyes via Inboria
-- Date: 2026-04-28
--
-- Contexte: Bug du detecteur de relances corrige dans
-- services/follow-up-detector.ts. L'ancienne version proposait des relances
-- pour tous les mails sortants (recipient IS NOT NULL), incluant ceux
-- simplement synchronises depuis Gmail/Outlook/IMAP (envoyes hors Inboria).
--
-- Resultat constate par l'utilisateur: 9 mails envoyes via Inboria mais
-- 83 suggestions de relance affichees, dont 74 portant sur des mails que
-- l'utilisateur n'a jamais envoyes depuis Inboria.
--
-- Fix code: filtre status="sent" + external_id IS NULL ajoute au detecteur.
--
-- Fix donnees: ce script (1) garantit que la colonne dismissed_at existe
-- (au cas ou la migration 2026_04_24_followups_ai_proactives.sql n'a pas
-- ete appliquee), puis (2) marque comme dismissed toutes les suggestions
-- IA en_attente qui pointent sur un mail dont external_id IS NOT NULL
-- (synchronise depuis Gmail/Outlook, pas envoye via Inboria).
--
-- 100% idempotent : peut etre relance sans danger.
-- =====================================================================

-- 1) Securite : creer la colonne dismissed_at si elle n'existe pas encore
--    (rattrapage de la migration 2026_04_24_followups_ai_proactives.sql)
ALTER TABLE public.followups
  ADD COLUMN IF NOT EXISTS dismissed_at timestamptz;

-- 2) Securite : creer aussi le delai de relance par defaut sur profiles
--    (meme rattrapage, sinon le detecteur retombe sur DEFAULT_DELAY_DAYS=5)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS follow_up_delay_days integer NOT NULL DEFAULT 5
  CHECK (follow_up_delay_days >= 1 AND follow_up_delay_days <= 60);

-- 3) Index utiles pour la detection (idempotents)
CREATE INDEX IF NOT EXISTS emails_user_recipient_created_idx
  ON public.emails (user_id, created_at DESC)
  WHERE recipient IS NOT NULL;

CREATE INDEX IF NOT EXISTS followups_email_ai_idx
  ON public.followups (user_id, email_id)
  WHERE ai_suggestion = true;

-- 4) Cleanup : marquer dismissed toutes les fausses suggestions IA
UPDATE public.followups f
SET
  dismissed_at = NOW(),
  updated_at   = NOW()
FROM public.emails e
WHERE f.email_id      = e.id
  AND f.ai_suggestion = TRUE
  AND f.status        = 'en_attente'
  AND f.dismissed_at IS NULL
  AND e.external_id  IS NOT NULL;

-- Verification (optionnel - a executer apres pour controle):
-- SELECT COUNT(*) AS dismissed_count
-- FROM public.followups f
-- JOIN public.emails    e ON e.id = f.email_id
-- WHERE f.ai_suggestion = TRUE
--   AND e.external_id  IS NOT NULL
--   AND f.dismissed_at IS NOT NULL;
