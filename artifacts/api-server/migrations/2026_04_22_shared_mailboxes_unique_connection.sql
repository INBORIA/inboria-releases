-- Enforce at the DB level that a single email connection cannot be shared
-- more than once. Previously the uniqueness was only checked in the API
-- layer, leaving room for a race condition (two concurrent share clicks)
-- or a bulk import to create duplicate `shared_mailboxes` rows pointing to
-- the same `connection_id`, which made the share toggle's state ambiguous
-- and prevented clean disable.

BEGIN;

-- Clean up any pre-existing duplicates so the unique index can be created.
-- Keep the oldest row per connection_id and remove the rest.
WITH ranked AS (
  SELECT id,
         connection_id,
         ROW_NUMBER() OVER (
           PARTITION BY connection_id
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM shared_mailboxes
  WHERE connection_id IS NOT NULL
)
DELETE FROM shared_mailboxes sm
USING ranked r
WHERE sm.id = r.id
  AND r.rn > 1;

-- Partial unique index: only enforced when connection_id is set,
-- so legacy / orphan shared mailboxes without a connection are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS shared_mailboxes_connection_id_unique
  ON shared_mailboxes (connection_id)
  WHERE connection_id IS NOT NULL;

COMMIT;
