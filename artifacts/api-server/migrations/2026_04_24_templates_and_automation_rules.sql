-- Migration : Templates IA + Règles automatiques étendues (Vague 2)
-- À appliquer manuellement dans Supabase SQL editor.
-- Add-only, idempotent.

BEGIN;

-- =========================================================================
-- 1. email_templates : bibliothèque personnelle de templates de réponse
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.email_templates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         text NOT NULL,
  subject      text NOT NULL DEFAULT '',
  body         text NOT NULL DEFAULT '',
  category_ai  text,
  variables    jsonb NOT NULL DEFAULT '[]'::jsonb,
  usage_count  integer NOT NULL DEFAULT 0,
  source_email_id integer,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_templates_user_id_idx
  ON public.email_templates (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS email_templates_user_category_idx
  ON public.email_templates (user_id, category_ai);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'email_templates' AND policyname = 'Users manage their templates'
  ) THEN
    CREATE POLICY "Users manage their templates"
      ON public.email_templates FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- =========================================================================
-- 2. automation_rules : règles SI X ALORS Y avec conditions/actions JSONB
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.automation_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id   uuid REFERENCES public.email_connections(id) ON DELETE CASCADE,
  name            text NOT NULL,
  natural_language_input text,
  conditions      jsonb NOT NULL DEFAULT '{}'::jsonb,
  actions         jsonb NOT NULL DEFAULT '[]'::jsonb,
  enabled         boolean NOT NULL DEFAULT true,
  last_run_at     timestamptz,
  runs_count      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS automation_rules_user_idx
  ON public.automation_rules (user_id, enabled);

CREATE INDEX IF NOT EXISTS automation_rules_connection_idx
  ON public.automation_rules (connection_id);

ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'automation_rules' AND policyname = 'Users manage their automation rules'
  ) THEN
    CREATE POLICY "Users manage their automation rules"
      ON public.automation_rules FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- =========================================================================
-- 3. rule_executions_audit : log de chaque action déclenchée par une règle
--    Permet le rollback des actions des dernières 24h.
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.rule_executions_audit (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_id       uuid REFERENCES public.automation_rules(id) ON DELETE SET NULL,
  email_id      integer,
  action_type   text NOT NULL,
  action_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  previous_state jsonb,
  rolled_back_at timestamptz,
  occurred_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rule_executions_user_idx
  ON public.rule_executions_audit (user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS rule_executions_rule_idx
  ON public.rule_executions_audit (rule_id);

CREATE INDEX IF NOT EXISTS rule_executions_email_idx
  ON public.rule_executions_audit (email_id);

ALTER TABLE public.rule_executions_audit ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'rule_executions_audit' AND policyname = 'Users view their rule audit'
  ) THEN
    CREATE POLICY "Users view their rule audit"
      ON public.rule_executions_audit FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

COMMIT;
