-- =====================================================================
-- Fix race condition causing duplicate emails
-- Adds UNIQUE constraint on (user_id, external_id) so concurrent syncs
-- can no longer insert the same Gmail/IMAP/Outlook message twice.
--
-- Idempotent: safe to run multiple times.
-- =====================================================================

-- 1) Cleanup: keep the lowest id per (user_id, external_id), delete the rest.
--    Children rows (tasks, appointments, attachments) are deleted first to
--    avoid FK violations. If your FKs are ON DELETE CASCADE, this is a no-op.
WITH dups AS (
  SELECT id
  FROM (
    SELECT id,
           row_number() OVER (PARTITION BY user_id, external_id ORDER BY id ASC) AS rn
    FROM emails
    WHERE external_id IS NOT NULL
  ) x
  WHERE rn > 1
)
DELETE FROM tasks WHERE email_id IN (SELECT id FROM dups);

WITH dups AS (
  SELECT id
  FROM (
    SELECT id,
           row_number() OVER (PARTITION BY user_id, external_id ORDER BY id ASC) AS rn
    FROM emails
    WHERE external_id IS NOT NULL
  ) x
  WHERE rn > 1
)
DELETE FROM appointments WHERE email_id IN (SELECT id FROM dups);

WITH dups AS (
  SELECT id
  FROM (
    SELECT id,
           row_number() OVER (PARTITION BY user_id, external_id ORDER BY id ASC) AS rn
    FROM emails
    WHERE external_id IS NOT NULL
  ) x
  WHERE rn > 1
)
DELETE FROM email_attachments WHERE email_id IN (SELECT id FROM dups);

WITH dups AS (
  SELECT id
  FROM (
    SELECT id,
           row_number() OVER (PARTITION BY user_id, external_id ORDER BY id ASC) AS rn
    FROM emails
    WHERE external_id IS NOT NULL
  ) x
  WHERE rn > 1
)
DELETE FROM emails WHERE id IN (SELECT id FROM dups);

-- 2) Unique partial index — prevents future duplicates atomically at the
--    PostgreSQL level. CONCURRENTLY would be ideal but cannot run inside
--    a transaction; standard CREATE INDEX is fine on a small table.
CREATE UNIQUE INDEX IF NOT EXISTS emails_user_external_id_uniq
  ON emails (user_id, external_id)
  WHERE external_id IS NOT NULL;
