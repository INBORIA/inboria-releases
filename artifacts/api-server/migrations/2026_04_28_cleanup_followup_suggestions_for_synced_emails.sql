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
-- Fix donnees: ce script marque comme dismissed (sans les supprimer pour
-- garder la trace) toutes les suggestions IA en_attente qui pointent sur
-- un mail dont external_id IS NOT NULL (= synchronise depuis Gmail/Outlook,
-- pas envoye via Inboria).
-- =====================================================================

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
