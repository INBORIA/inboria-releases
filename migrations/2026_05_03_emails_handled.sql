-- Task #205: refonte de la métrique "Traité".
-- Un email est considéré "traité" UNIQUEMENT quand un humain a posé une
-- action explicite : envoi de réponse, transfert, ou clic manuel "Marquer
-- traité". Les colonnes existantes (assigned_to / claimed_by) sont posées
-- automatiquement par Inboria à l'ingestion et ne peuvent donc pas servir
-- d'indicateur de traitement.
ALTER TABLE emails
  ADD COLUMN IF NOT EXISTS handled_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS handled_by UUID NULL;

CREATE INDEX IF NOT EXISTS idx_emails_handled_at
  ON emails (handled_at)
  WHERE handled_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_emails_handled_by
  ON emails (handled_by)
  WHERE handled_by IS NOT NULL;
