-- =====================================================================
-- Performance: index pour accelerer le listing de l'inbox
--
-- Objectif: faire passer le tri (user_id, created_at DESC) et le
-- count(*) filtre de ~300 ms a <30 ms sur les comptes ayant >100 mails.
--
-- Idempotent : safe a relancer.
-- =====================================================================

-- Index composite principal: tri + filtre par utilisateur (inbox normale)
CREATE INDEX IF NOT EXISTS emails_user_created_idx
  ON emails (user_id, created_at DESC)
  WHERE shared_mailbox_id IS NULL;

-- Index pour les vues "boites partagees"
CREATE INDEX IF NOT EXISTS emails_shared_mb_created_idx
  ON emails (shared_mailbox_id, created_at DESC)
  WHERE shared_mailbox_id IS NOT NULL;

-- Index pour les filtres frequents par status
-- (corbeille, spam, archives, envoyes)
CREATE INDEX IF NOT EXISTS emails_user_status_created_idx
  ON emails (user_id, status, created_at DESC);

-- Index pour les filtres par categorie et projet
CREATE INDEX IF NOT EXISTS emails_user_category_idx
  ON emails (user_id, category_id)
  WHERE category_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS emails_user_project_idx
  ON emails (user_id, project_id)
  WHERE project_id IS NOT NULL;

-- Mise a jour des statistiques pour que le planner profite des index
ANALYZE emails;
