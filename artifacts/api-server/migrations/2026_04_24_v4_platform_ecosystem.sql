-- Migration : Vague 4 — Plateforme & écosystème (HubSpot, Pipedrive, Zapier/Make/n8n, WhatsApp, SMS)
-- À appliquer manuellement dans Supabase SQL editor.
-- Add-only, idempotent (IF NOT EXISTS partout).

-- 1. Étendre la table integrations existante
ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS refresh_token text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS scopes text,
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text;

CREATE INDEX IF NOT EXISTS idx_integrations_user_provider
  ON public.integrations (user_id, provider);

-- 2. CRM : contacts miroir (HubSpot, Pipedrive)
CREATE TABLE IF NOT EXISTS public.crm_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('hubspot', 'pipedrive')),
  external_id text NOT NULL,
  email text,
  first_name text,
  last_name text,
  company text,
  phone text,
  raw jsonb,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_contacts_user_provider_external_uniq
  ON public.crm_contacts (user_id, provider, external_id);
CREATE INDEX IF NOT EXISTS crm_contacts_user_email_idx
  ON public.crm_contacts (user_id, lower(email));

ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_contacts' AND policyname='crm_contacts_select_own') THEN
    CREATE POLICY "crm_contacts_select_own" ON public.crm_contacts FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- 3. CRM : deals miroir (lecture seule)
CREATE TABLE IF NOT EXISTS public.crm_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('hubspot', 'pipedrive')),
  external_id text NOT NULL,
  title text,
  amount numeric,
  currency text,
  stage text,
  status text,
  contact_external_id text,
  raw jsonb,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_deals_user_provider_external_uniq
  ON public.crm_deals (user_id, provider, external_id);
CREATE INDEX IF NOT EXISTS crm_deals_user_contact_idx
  ON public.crm_deals (user_id, provider, contact_external_id);

ALTER TABLE public.crm_deals ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_deals' AND policyname='crm_deals_select_own') THEN
    CREATE POLICY "crm_deals_select_own" ON public.crm_deals FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- 4. CRM : log des emails poussés vers le CRM (idempotence)
CREATE TABLE IF NOT EXISTS public.crm_email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('hubspot', 'pipedrive')),
  email_id integer NOT NULL,
  external_log_id text,
  pushed_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_email_logs_user_provider_email_uniq
  ON public.crm_email_logs (user_id, provider, email_id);

ALTER TABLE public.crm_email_logs ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_email_logs' AND policyname='crm_email_logs_select_own') THEN
    CREATE POLICY "crm_email_logs_select_own" ON public.crm_email_logs FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- 5. Clés API publiques (Zapier / Make / n8n)
CREATE TABLE IF NOT EXISTS public.public_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL,
  scopes text[] NOT NULL DEFAULT ARRAY['read', 'write']::text[],
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS public_api_keys_user_idx ON public.public_api_keys (user_id);
CREATE INDEX IF NOT EXISTS public_api_keys_hash_idx ON public.public_api_keys (key_hash);

ALTER TABLE public.public_api_keys ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='public_api_keys' AND policyname='public_api_keys_select_own') THEN
    CREATE POLICY "public_api_keys_select_own" ON public.public_api_keys FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- 6. Webhooks sortants (Zapier triggers, Make, n8n, custom)
CREATE TABLE IF NOT EXISTS public.webhook_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'email.received', 'email.sent', 'task.created', 'task.completed',
    'appointment.created', 'rule.triggered', 'message.received'
  )),
  target_url text NOT NULL,
  secret text,
  description text,
  enabled boolean NOT NULL DEFAULT true,
  failure_count integer NOT NULL DEFAULT 0,
  last_triggered_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webhook_subscriptions_user_event_idx
  ON public.webhook_subscriptions (user_id, event_type) WHERE enabled = true;

ALTER TABLE public.webhook_subscriptions ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='webhook_subscriptions' AND policyname='webhook_subscriptions_select_own') THEN
    CREATE POLICY "webhook_subscriptions_select_own" ON public.webhook_subscriptions FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- 7. Canaux de messagerie (WhatsApp Business, SMS Twilio)
CREATE TABLE IF NOT EXISTS public.messaging_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('whatsapp', 'sms_twilio', 'sms_brevo')),
  display_name text NOT NULL,
  phone_number text NOT NULL,
  external_id text,
  credentials jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  last_inbound_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS messaging_channels_user_provider_phone_uniq
  ON public.messaging_channels (user_id, provider, phone_number);

ALTER TABLE public.messaging_channels ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='messaging_channels' AND policyname='messaging_channels_select_own') THEN
    CREATE POLICY "messaging_channels_select_own" ON public.messaging_channels FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- 8. Messages multicanal unifiés (WhatsApp / SMS)
-- NB : les emails restent dans `emails` ; cette table est dédiée aux canaux non-email.
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES public.messaging_channels(id) ON DELETE CASCADE,
  provider text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  external_id text,
  from_address text NOT NULL,
  to_address text NOT NULL,
  body text,
  status text NOT NULL DEFAULT 'received',
  thread_key text,
  read_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_user_created_idx ON public.messages (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_user_channel_idx ON public.messages (user_id, channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_user_thread_idx ON public.messages (user_id, thread_key);
CREATE UNIQUE INDEX IF NOT EXISTS messages_user_provider_external_uniq
  ON public.messages (user_id, provider, external_id) WHERE external_id IS NOT NULL;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='messages' AND policyname='messages_select_own') THEN
    CREATE POLICY "messages_select_own" ON public.messages FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;
