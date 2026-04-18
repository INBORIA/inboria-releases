-- ============================================================
-- Inboria — Pre-filter & sender cache (rev. 1)
-- ============================================================
-- A executer une seule fois dans le SQL editor de Supabase.
-- Idempotent : peut etre relance sans danger.
-- ============================================================

-- 1) Table de cache des classifications par expediteur recurrent
CREATE TABLE IF NOT EXISTS public.sender_cache (
  user_id        uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_email   text        NOT NULL,
  category_name  text        NOT NULL,
  priority       text        NOT NULL CHECK (priority IN ('urgent','moyen','faible')),
  hit_count      int         NOT NULL DEFAULT 1,
  last_used_at   timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, sender_email)
);

CREATE INDEX IF NOT EXISTS idx_sender_cache_user_last
  ON public.sender_cache (user_id, last_used_at DESC);

-- 2) Compteurs de metriques sur profiles (pour mesurer le gain reel)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS prefilter_hits_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cache_hits_count     int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_calls_count       int NOT NULL DEFAULT 0;

-- 3) RPC d'incrementation atomique des compteurs
CREATE OR REPLACE FUNCTION public.increment_prefilter_metrics(
  user_id_input uuid,
  prefilter_inc int DEFAULT 0,
  cache_inc     int DEFAULT 0,
  ai_inc        int DEFAULT 0
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles
  SET prefilter_hits_count = prefilter_hits_count + prefilter_inc,
      cache_hits_count     = cache_hits_count     + cache_inc,
      ai_calls_count       = ai_calls_count       + ai_inc
  WHERE id = user_id_input;
$$;

-- 3bis) RPC atomique pour upsert + increment du cache (evite les race conditions)
CREATE OR REPLACE FUNCTION public.upsert_sender_cache(
  user_id_input    uuid,
  sender_input     text,
  category_input   text,
  priority_input   text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.sender_cache (user_id, sender_email, category_name, priority, hit_count, last_used_at)
  VALUES (user_id_input, sender_input, category_input, priority_input, 1, now())
  ON CONFLICT (user_id, sender_email) DO UPDATE
    SET hit_count    = CASE
                         WHEN sender_cache.category_name = EXCLUDED.category_name
                          AND sender_cache.priority      = EXCLUDED.priority
                         THEN sender_cache.hit_count + 1
                         ELSE 1
                       END,
        category_name = EXCLUDED.category_name,
        priority      = EXCLUDED.priority,
        last_used_at  = now();
END;
$$;

-- 4) RLS : les users voient leurs propres entrees du cache
ALTER TABLE public.sender_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sender_cache_owner_select" ON public.sender_cache;
CREATE POLICY "sender_cache_owner_select"
  ON public.sender_cache FOR SELECT
  USING (auth.uid() = user_id);

-- Le service (admin) gere insert/update/delete via supabaseAdmin (bypass RLS).

-- 5) Purge des entrees inactives > 60 jours (a executer periodiquement, ou via cron)
-- DELETE FROM public.sender_cache WHERE last_used_at < now() - interval '60 days';
