-- Migration : table blocked_senders (Inboria)
-- À appliquer manuellement dans Supabase SQL editor.
-- Add-only, idempotent (IF NOT EXISTS partout).

CREATE TABLE IF NOT EXISTS public.blocked_senders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.email_connections(id) ON DELETE CASCADE,
  email_address text NOT NULL,
  provider text NOT NULL,
  provider_rule_id text,
  scope text NOT NULL DEFAULT 'connection' CHECK (scope IN ('connection', 'all_accounts')),
  blocked_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS blocked_senders_user_conn_email_uniq
  ON public.blocked_senders (user_id, connection_id, email_address);

CREATE INDEX IF NOT EXISTS blocked_senders_user_id_idx
  ON public.blocked_senders (user_id);

CREATE INDEX IF NOT EXISTS blocked_senders_connection_id_idx
  ON public.blocked_senders (connection_id);

ALTER TABLE public.blocked_senders ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'blocked_senders' AND policyname = 'Users can view their blocked senders'
  ) THEN
    CREATE POLICY "Users can view their blocked senders"
      ON public.blocked_senders FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'blocked_senders' AND policyname = 'Users can insert their blocked senders'
  ) THEN
    CREATE POLICY "Users can insert their blocked senders"
      ON public.blocked_senders FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'blocked_senders' AND policyname = 'Users can delete their blocked senders'
  ) THEN
    CREATE POLICY "Users can delete their blocked senders"
      ON public.blocked_senders FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;
