-- Task #306 phase 6 — post-validation langue.
-- Ajoute le flag `language_drift_detected` à inboria_chat_logs pour mesurer
-- combien de réponses Inboria sont parties dans la mauvaise langue (mismatch
-- entre langue de la question et langue de la réponse). Si TRUE, on a déjà
-- déclenché un retry strict qui a soit corrigé silencieusement, soit échoué.
-- Permet de prioriser les bugs langue dans le dashboard admin.

ALTER TABLE public.inboria_chat_logs
  ADD COLUMN IF NOT EXISTS language_drift_detected boolean NOT NULL DEFAULT false;

-- Index partiel pour requêter rapidement les drift dans le dashboard admin
-- (très peu de drift attendus, donc partiel WHERE TRUE = ultra léger).
CREATE INDEX IF NOT EXISTS inboria_chat_logs_lang_drift_idx
  ON public.inboria_chat_logs (created_at DESC)
  WHERE language_drift_detected = true;
