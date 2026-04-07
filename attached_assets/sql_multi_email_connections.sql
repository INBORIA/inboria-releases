-- Migration: Multi-email connections
-- Allows multiple email connections per provider (e.g., 2 Gmail accounts)
-- Changes UNIQUE constraint from (user_id, provider) to (user_id, email_address)

-- Step 1: Drop the old unique constraint on (user_id, provider)
-- The constraint name may vary; try the most common naming conventions
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'email_connections'
    AND constraint_type = 'UNIQUE'
    AND constraint_name = 'email_connections_user_id_provider_key'
  ) THEN
    ALTER TABLE email_connections DROP CONSTRAINT email_connections_user_id_provider_key;
  END IF;
END $$;

-- Also try alternate names
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'email_connections'
    AND constraint_type = 'UNIQUE'
    AND constraint_name LIKE '%user_id%provider%'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE email_connections DROP CONSTRAINT ' || constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'email_connections'
      AND constraint_type = 'UNIQUE'
      AND constraint_name LIKE '%user_id%provider%'
      LIMIT 1
    );
  END IF;
END $$;

-- Step 2: Add new unique constraint on (user_id, email_address)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'email_connections'
    AND constraint_type = 'UNIQUE'
    AND constraint_name = 'email_connections_user_id_email_address_key'
  ) THEN
    ALTER TABLE email_connections ADD CONSTRAINT email_connections_user_id_email_address_key UNIQUE (user_id, email_address);
  END IF;
END $$;

-- Step 3: Ensure shared_mailboxes has connection_id column
ALTER TABLE shared_mailboxes ADD COLUMN IF NOT EXISTS connection_id UUID REFERENCES email_connections(id) ON DELETE SET NULL;
