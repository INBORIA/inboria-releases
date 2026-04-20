-- Variant B: AI credit metering with monthly reset
-- Adds separate AI credit counter and monthly billing period anchor on profiles.
-- Adds an audit trail of every credit-consuming event.
-- Adds an atomic RPC for safe concurrent credit increments.

BEGIN;

-- 1. Profiles: AI credits + monthly period anchor
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS ai_credits_used INTEGER NOT NULL DEFAULT 0;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS quota_period_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', NOW());

-- 2. Audit table of every metered AI event
CREATE TABLE IF NOT EXISTS usage_events (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL,
  event_type  TEXT NOT NULL,
  credits     INTEGER NOT NULL,
  metadata    JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS usage_events_user_occurred_idx
  ON usage_events (user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS usage_events_user_type_idx
  ON usage_events (user_id, event_type);

-- 3. Backfill quota_period_start
UPDATE profiles
SET quota_period_start = date_trunc('month', NOW())
WHERE quota_period_start IS NULL;

-- 4. Atomic increment RPC (avoids race conditions when several AI calls overlap)
CREATE OR REPLACE FUNCTION increment_ai_credits(p_user_id UUID, p_amount INTEGER)
RETURNS INTEGER AS $$
DECLARE new_value INTEGER;
BEGIN
  UPDATE profiles
  SET ai_credits_used = COALESCE(ai_credits_used, 0) + p_amount
  WHERE id = p_user_id
  RETURNING ai_credits_used INTO new_value;
  RETURN new_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION increment_ai_credits(UUID, INTEGER) TO service_role, authenticated;

COMMIT;
