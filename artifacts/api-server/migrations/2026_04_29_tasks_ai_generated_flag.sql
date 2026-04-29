-- Distingue les tâches générées automatiquement par le triage IA des tâches
-- créées manuellement par l'utilisateur (y compris depuis le panneau d'un
-- email). Avant cette migration, le badge "IA" était calculé côté API à
-- partir de email_id IS NOT NULL, ce qui marquait à tort comme "IA" toute
-- tâche manuelle rattachée à un email. Le drapeau ai_generated devient la
-- seule source de vérité.
--
-- Backfill : on conserve l'apparence actuelle pour les tâches existantes en
-- marquant TRUE toutes celles déjà liées à un email. Aucune tâche existante
-- ne perdra son badge "IA" suite à cette migration. À partir de maintenant,
-- les nouvelles tâches créées manuellement via POST /tasks ou via une règle
-- d'automatisation (que l'utilisateur a définie lui-même) restent FALSE et
-- n'apparaîtront plus dans l'onglet "IA".
--
-- Index partiel : sert le compteur et le filtre de l'onglet IA sans gonfler
-- l'index global de la table.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS ai_generated boolean NOT NULL DEFAULT false;

UPDATE public.tasks
  SET ai_generated = true
  WHERE email_id IS NOT NULL AND ai_generated = false;

CREATE INDEX IF NOT EXISTS tasks_user_ai_generated_idx
  ON public.tasks (user_id, ai_generated)
  WHERE ai_generated = true;
