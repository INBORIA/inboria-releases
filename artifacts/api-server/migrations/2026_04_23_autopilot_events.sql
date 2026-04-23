-- Table dédiée aux événements Autopilot (live indicator + timeline 24h).
-- Découplée de usage_events (qui sert au billing) pour rester légère et lisible.
-- Apply via Supabase SQL editor.

CREATE TABLE IF NOT EXISTS autopilot_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  title text,
  email_id integer,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_autopilot_events_user_created
  ON autopilot_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_autopilot_events_user_type_created
  ON autopilot_events(user_id, event_type, created_at DESC);

ALTER TABLE autopilot_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "autopilot_events_select_own" ON autopilot_events;
CREATE POLICY "autopilot_events_select_own"
  ON autopilot_events FOR SELECT
  USING (user_id = auth.uid());

-- Le service role (api-server) bypasses RLS via SUPABASE_SECRET_KEY.
-- Le client web utilise Realtime en SELECT seulement.

-- Activer Realtime pour cette table (publication supabase_realtime).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'autopilot_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE autopilot_events;
  END IF;
END $$;

-- Auto-purge des événements > 7 jours (la timeline ne dépasse jamais 24h côté UI,
-- on garde 7j de marge pour stats/debug). Optionnel : à scheduler via pg_cron.
-- Exemple : SELECT cron.schedule('purge_autopilot_events', '0 3 * * *',
--   $$ DELETE FROM autopilot_events WHERE created_at < now() - interval '7 days' $$);
