-- Correctif du backfill ai_generated.
--
-- La migration précédente (2026_04_29_tasks_ai_generated_flag.sql) a marqué
-- ai_generated = true pour TOUTES les tâches liées à un email, ce qui inclut
-- à tort les tâches créées manuellement par l'utilisateur depuis le panneau
-- d'un email. On utilise ici la table autopilot_events pour rectifier : la
-- route POST /tasks log systématiquement un évènement "task_created", ce que
-- le triage IA (webhook + auto-sync) et les règles d'automatisation ne font
-- pas. On peut donc identifier rétroactivement les vraies créations
-- manuelles et leur rendre ai_generated = false.
--
-- Critère de matching : même utilisateur, même titre, et évènement émis dans
-- une fenêtre de quelques secondes autour de la création de la tâche (le
-- recordAutopilotEvent est appelé immédiatement après l'INSERT). Une fenêtre
-- de [-5s ; +5min] absorbe les latences réseau et un éventuel retard de
-- traitement asynchrone, sans risque de collision avec une tâche IA portant
-- le même titre.
--
-- Idempotent : safe à rejouer.

UPDATE public.tasks t
SET ai_generated = false
WHERE t.ai_generated = true
  AND EXISTS (
    SELECT 1
    FROM public.autopilot_events ae
    WHERE ae.user_id = t.user_id
      AND ae.event_type = 'task_created'
      AND ae.title = t.title
      AND ae.created_at BETWEEN t.created_at - interval '5 seconds'
                            AND t.created_at + interval '5 minutes'
  );
