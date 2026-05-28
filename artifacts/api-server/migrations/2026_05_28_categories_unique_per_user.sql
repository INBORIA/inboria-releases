-- Tâche : empêcher la création de doublons exacts de catégories par race
-- condition au triage. Symptôme observé : 79 catégories "Newsletters" pour
-- le même user → C(79,2) = 3081 paires identiques affichées dans le panneau
-- "Nettoyer les doublons". Root cause : auto-sync.ts et webhook.ts font
-- SELECT-then-INSERT sans contrainte unique, 100+ INSERT parallèles passent
-- tous quand l'IA renvoie "Newsletters" pour 100+ emails.
--
-- Cette migration fait DEUX choses dans l'ordre :
--   1) Dédoublonner les catégories existantes par (user_id, lower(trim(name)))
--      en gardant la catégorie qui contient le PLUS d'emails (à id le plus
--      petit en cas d'égalité), réaffecter les emails des copies à elle,
--      puis supprimer les copies.
--   2) Créer un index UNIQUE partiel sur (user_id, lower(trim(name)))
--      WHERE is_system = false, pour que tout INSERT en conflit soit rejeté
--      avec un code 23505 que le code applicatif (auto-sync.ts L680,
--      webhook.ts L175) sait déjà gérer (refetch + use existing id).
--
-- IDEMPOTENTE : peut être réappliquée sans dommage. Le DO $$ … END $$
-- détecte si l'index existe déjà et skip la phase de dédup.

BEGIN;

DO $$
DECLARE
  v_index_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'categories_user_name_unique'
  ) INTO v_index_exists;

  IF v_index_exists THEN
    RAISE NOTICE 'categories_user_name_unique already exists — skipping dedup phase';
    RETURN;
  END IF;

  -- Phase 1 : dédoublonnage. On utilise une CTE qui désigne le "winner" par
  -- groupe (user_id, lower(trim(name))) WHERE is_system = false, puis on
  -- réaffecte les emails des perdants au winner, puis on supprime les perdants.
  CREATE TEMP TABLE _cat_winners ON COMMIT DROP AS
  WITH ranked AS (
    SELECT
      c.id,
      c.user_id,
      lower(trim(c.name)) AS norm_name,
      (
        SELECT COUNT(*) FROM public.emails e
        WHERE e.category_id = c.id AND e.user_id = c.user_id
      ) AS email_count,
      ROW_NUMBER() OVER (
        PARTITION BY c.user_id, lower(trim(c.name))
        ORDER BY
          (SELECT COUNT(*) FROM public.emails e
           WHERE e.category_id = c.id AND e.user_id = c.user_id) DESC,
          c.id ASC
      ) AS rn
    FROM public.categories c
    WHERE COALESCE(c.is_system, false) = false
      AND c.name IS NOT NULL
      AND length(trim(c.name)) > 0
  )
  SELECT * FROM ranked;

  -- Réaffectation des emails des "perdants" (rn > 1) vers le "winner" (rn = 1)
  -- du même groupe (user_id, norm_name).
  UPDATE public.emails e
  SET category_id = w.id
  FROM _cat_winners losers
  JOIN _cat_winners w
    ON w.user_id = losers.user_id
   AND w.norm_name = losers.norm_name
   AND w.rn = 1
  WHERE losers.rn > 1
    AND e.category_id = losers.id
    AND e.user_id = losers.user_id;

  -- Suppression des perdants.
  DELETE FROM public.categories c
  USING _cat_winners losers
  WHERE losers.rn > 1
    AND c.id = losers.id;

  RAISE NOTICE 'Dedup phase completed — proceeding to unique index creation';
END $$;

-- Phase 2 : index unique partiel. Bloque toute future création de doublon
-- exact côté Postgres. Le code applicatif gère déjà le code 23505 (fallback
-- vers SELECT id de la catégorie existante).
CREATE UNIQUE INDEX IF NOT EXISTS categories_user_name_unique
  ON public.categories (user_id, lower(trim(name)))
  WHERE COALESCE(is_system, false) = false;

COMMIT;
