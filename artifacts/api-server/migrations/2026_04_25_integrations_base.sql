-- Migration : créer la table `integrations` manquante (base) + colonnes v4 fusionnées.
-- À appliquer manuellement dans Supabase SQL Editor.
-- Add-only, idempotent (IF NOT EXISTS partout).

CREATE TABLE IF NOT EXISTS public.integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  scopes text,
  workspace_name text,
  channel_id text,
  database_id text,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS integrations_user_provider_uniq
  ON public.integrations (user_id, provider);

CREATE INDEX IF NOT EXISTS idx_integrations_user_provider
  ON public.integrations (user_id, provider);

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'integrations' AND policyname = 'integrations_select_own'
  ) THEN
    CREATE POLICY "integrations_select_own"
      ON public.integrations
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Force PostgREST schema cache reload so /rest/v1/integrations devient visible.
NOTIFY pgrst, 'reload schema';
