-- 2026-04-28 — Suppression complète des intégrations Slack et Notion.
-- Le produit ne supporte plus ces deux intégrations. Cette migration nettoie
-- les données associées et purge les actions de règles d'automatisation qui
-- y faisaient référence. Idempotente.

BEGIN;

-- 1) Purge des notifications loggées (table créée le 2026-04-27).
DELETE FROM notification_log
 WHERE provider IN ('slack', 'notion');

-- 2) Purge des intégrations elles-mêmes (tokens OAuth, channels, databases).
DELETE FROM integrations
 WHERE provider IN ('slack', 'notion');

-- 3) Nettoyage des règles d'automatisation : retire les actions
--    `slack_notify` et `notion_create` du tableau JSON `actions`.
--    Si une règle n'avait QUE ces actions, on la supprime entièrement
--    (une règle sans action est invalide côté API).
UPDATE automation_rules
   SET actions = COALESCE(
     (
       SELECT jsonb_agg(elem)
         FROM jsonb_array_elements(actions) AS elem
        WHERE elem ->> 'type' NOT IN ('slack_notify', 'notion_create')
     ),
     '[]'::jsonb
   )
 WHERE actions @> '[{"type":"slack_notify"}]'::jsonb
    OR actions @> '[{"type":"notion_create"}]'::jsonb;

DELETE FROM automation_rules
 WHERE jsonb_array_length(actions) = 0;

-- 4) Audit : retire les enregistrements d'exécution liés à ces actions
--    pour ne pas garder d'historique trompeur côté admin.
DELETE FROM rule_executions_audit
 WHERE action_type IN ('slack_notify', 'notion_create');

-- 5) Politiques SLA : retire la clé `slack` du JSON `escalation` si présente.
UPDATE sla_policies
   SET escalation = (escalation - 'slack')
 WHERE escalation ? 'slack';

COMMIT;
