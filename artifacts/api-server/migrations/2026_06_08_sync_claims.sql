-- 2026_06_08_sync_claims.sql
-- Point n°1 (montée en charge) : verrou distribué pour la relève multi-serveurs.
-- Permet à PLUSIEURS instances serveur de se partager les boîtes à relever
-- sans jamais traiter deux fois le même mail (work-queue, FOR UPDATE SKIP LOCKED).
--
-- À APPLIQUER MANUELLEMENT dans Supabase (SQL Editor).
-- Tant que la migration n'est PAS appliquée, le code retombe automatiquement
-- sur l'ancien comportement mono-serveur (SELECT de toutes les connexions),
-- donc aucun impact sur un déploiement à un seul serveur.

ALTER TABLE email_connections
  ADD COLUMN IF NOT EXISTS sync_locked_by text,
  ADD COLUMN IF NOT EXISTS sync_locked_until timestamptz;

-- Index pour réserver efficacement les connexions libres ou dont le bail a expiré.
CREATE INDEX IF NOT EXISTS email_connections_sync_lock_idx
  ON email_connections (sync_locked_until);

-- Réservation atomique d'un lot de connexions.
-- Deux instances qui appellent SIMULTANÉMENT obtiennent des lignes DIFFÉRENTES
-- grâce à FOR UPDATE SKIP LOCKED. Le bail (sync_locked_until) expire tout seul
-- si l'instance qui détient la réservation plante en cours de route.
CREATE OR REPLACE FUNCTION claim_email_connections(
  p_instance text,
  p_limit int,
  p_ttl_seconds int
)
RETURNS SETOF email_connections
LANGUAGE sql
AS $claim$
  UPDATE email_connections c
  SET sync_locked_by = p_instance,
      sync_locked_until = now() + make_interval(secs => p_ttl_seconds)
  WHERE c.id IN (
    SELECT id FROM email_connections
    WHERE sync_locked_until IS NULL OR sync_locked_until < now()
    ORDER BY last_synced_at NULLS FIRST
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING c.*;
$claim$;

-- Libération d'un lot après traitement. Une instance ne peut libérer que SES
-- propres réservations (garde-fou sync_locked_by = p_instance). id::text rend la
-- fonction robuste que la colonne id soit de type uuid ou text.
CREATE OR REPLACE FUNCTION release_email_connections(
  p_instance text,
  p_ids text[]
)
RETURNS void
LANGUAGE sql
AS $release$
  UPDATE email_connections
  SET sync_locked_by = NULL, sync_locked_until = NULL
  WHERE id::text = ANY(p_ids) AND sync_locked_by = p_instance;
$release$;

GRANT EXECUTE ON FUNCTION claim_email_connections(text, int, int) TO service_role;
GRANT EXECUTE ON FUNCTION release_email_connections(text, text[]) TO service_role;
