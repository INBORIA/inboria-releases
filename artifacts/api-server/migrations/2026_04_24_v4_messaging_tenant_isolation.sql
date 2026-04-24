-- Vague 4 hot-fix : enforce hard tenant isolation on inbound WhatsApp / Twilio webhooks.
--
-- Background
-- ----------
-- The original migration created `messaging_channels` with only a per-user
-- composite uniqueness `(user_id, provider, phone_number)`. Inbound WhatsApp /
-- Twilio webhooks route to the channel matching the provider identifier:
--   - WhatsApp uses `external_id` (Meta phone_number_id)
--   - Twilio uses `phone_number` (the To number)
-- Without a *global* uniqueness on those identifiers, two tenants could end up
-- with the same identifier configured (legitimate edge case for Twilio numbers
-- being recycled, or malicious "hijack" attempts) and an inbound webhook would
-- be delivered to *both* tenants — a cross-tenant PII leak.
--
-- This migration:
--   1. Creates partial unique indexes that make the provider identifiers
--      globally unique across the whole `messaging_channels` table.
--   2. Cleans up any existing duplicates by leaving the oldest row enabled and
--      disabling the duplicates (defensive — the application should never have
--      created duplicates in practice).
-- ============================================================================

-- 1. WhatsApp : (provider='whatsapp', external_id) must be globally unique.
DO $$
BEGIN
  -- Defensive cleanup: disable any duplicate WhatsApp channels (same external_id
  -- across different tenants). Keep the oldest one enabled.
  WITH ranked AS (
    SELECT id,
           row_number() OVER (PARTITION BY external_id ORDER BY created_at ASC, id ASC) AS rn
    FROM public.messaging_channels
    WHERE provider = 'whatsapp' AND external_id IS NOT NULL
  )
  UPDATE public.messaging_channels mc
     SET enabled = false
    FROM ranked r
   WHERE mc.id = r.id AND r.rn > 1;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS messaging_channels_whatsapp_external_id_uniq
  ON public.messaging_channels (provider, external_id)
  WHERE provider = 'whatsapp' AND external_id IS NOT NULL;

-- 2. Twilio SMS : (provider='sms_twilio', phone_number) must be globally unique.
-- Twilio numbers are owned by exactly one customer account at any given time,
-- so a phone number cannot legitimately belong to two Inboria tenants.
DO $$
BEGIN
  WITH ranked AS (
    SELECT id,
           row_number() OVER (PARTITION BY phone_number ORDER BY created_at ASC, id ASC) AS rn
    FROM public.messaging_channels
    WHERE provider = 'sms_twilio' AND phone_number IS NOT NULL
  )
  UPDATE public.messaging_channels mc
     SET enabled = false
    FROM ranked r
   WHERE mc.id = r.id AND r.rn > 1;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS messaging_channels_twilio_phone_uniq
  ON public.messaging_channels (provider, phone_number)
  WHERE provider = 'sms_twilio' AND phone_number IS NOT NULL;
