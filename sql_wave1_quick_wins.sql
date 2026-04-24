-- Inboria — Vague 1 Quick Wins UX (Snooze, Envoi programmé, Suivi d'ouverture)
-- A executer UNE FOIS dans Supabase Dashboard > SQL Editor

ALTER TABLE public.emails
  ADD COLUMN IF NOT EXISTS snoozed_until timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_send_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS opened_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tracking_pixel_id text,
  ADD COLUMN IF NOT EXISTS scheduled_send_error text,
  ADD COLUMN IF NOT EXISTS scheduled_connection_id uuid;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tracking_enabled boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_emails_snoozed_until
  ON public.emails(snoozed_until)
  WHERE snoozed_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_emails_scheduled_send_at
  ON public.emails(scheduled_send_at)
  WHERE scheduled_send_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_emails_tracking_pixel_id
  ON public.emails(tracking_pixel_id)
  WHERE tracking_pixel_id IS NOT NULL;
