-- Vague 3 — Crédibilité B2B (SLA + Public API + Webhooks + Mentions)
-- À appliquer manuellement dans Supabase SQL editor.
-- Add-only, idempotent.

-- =========================================================
-- 1) SLA policies par boîte partagée
-- =========================================================
CREATE TABLE IF NOT EXISTS public.sla_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_mailbox_id uuid NOT NULL REFERENCES public.shared_mailboxes(id) ON DELETE CASCADE,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  target_minutes integer NOT NULL DEFAULT 240 CHECK (target_minutes BETWEEN 5 AND 10080),
  business_hours jsonb NOT NULL DEFAULT '{"timezone":"Europe/Brussels","days":[1,2,3,4,5],"start":"09:00","end":"18:00"}'::jsonb,
  escalation jsonb NOT NULL DEFAULT '{"slack":true,"email":true}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sla_policies_mailbox_uniq
  ON public.sla_policies (shared_mailbox_id);
CREATE INDEX IF NOT EXISTS sla_policies_org_idx
  ON public.sla_policies (organisation_id);

CREATE TABLE IF NOT EXISTS public.sla_breaches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid NOT NULL REFERENCES public.sla_policies(id) ON DELETE CASCADE,
  shared_mailbox_id uuid NOT NULL REFERENCES public.shared_mailboxes(id) ON DELETE CASCADE,
  email_id integer NOT NULL REFERENCES public.emails(id) ON DELETE CASCADE,
  assigned_to uuid,
  target_minutes integer NOT NULL,
  elapsed_minutes integer NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz,
  resolved_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS sla_breaches_email_uniq
  ON public.sla_breaches (email_id);
CREATE INDEX IF NOT EXISTS sla_breaches_mailbox_idx
  ON public.sla_breaches (shared_mailbox_id);
CREATE INDEX IF NOT EXISTS sla_breaches_unresolved_idx
  ON public.sla_breaches (shared_mailbox_id) WHERE resolved_at IS NULL;

-- =========================================================
-- 2) Clés API utilisateur (public API)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  scopes text[] NOT NULL DEFAULT ARRAY['emails:read','tasks:write','appointments:write','contacts:write','rules:trigger']::text[],
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_keys_user_idx
  ON public.api_keys (user_id);
CREATE INDEX IF NOT EXISTS api_keys_hash_idx
  ON public.api_keys (key_hash);

-- Compteur in-memory côté serveur ; on garde une trace simple si besoin
CREATE TABLE IF NOT EXISTS public.api_key_usage (
  id bigserial PRIMARY KEY,
  api_key_id uuid NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  status_code integer NOT NULL,
  called_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_key_usage_key_idx
  ON public.api_key_usage (api_key_id, called_at DESC);

-- =========================================================
-- 3) Webhooks outbound
-- =========================================================
CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url text NOT NULL,
  secret text NOT NULL,
  events text[] NOT NULL DEFAULT ARRAY['email.received','email.sent','task.created','appointment.created','rule.triggered']::text[],
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webhook_endpoints_user_idx
  ON public.webhook_endpoints (user_id);

CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id uuid NOT NULL REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','success','failed','exhausted')),
  attempts integer NOT NULL DEFAULT 0,
  last_status_code integer,
  last_error text,
  next_attempt_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webhook_deliveries_pending_idx
  ON public.webhook_deliveries (next_attempt_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS webhook_deliveries_endpoint_idx
  ON public.webhook_deliveries (endpoint_id, created_at DESC);

-- =========================================================
-- 4) Comment mentions (chat équipe in-thread)
-- =========================================================
ALTER TABLE public.email_comments
  ADD COLUMN IF NOT EXISTS mentions uuid[] NOT NULL DEFAULT ARRAY[]::uuid[];

CREATE INDEX IF NOT EXISTS email_comments_email_id_idx
  ON public.email_comments (email_id, created_at);
