-- Add country column to profiles table for EU/EEE geographic restriction
-- Run this in Supabase SQL Editor

-- Step 1: Add the column (nullable first for existing rows)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country TEXT;

-- Step 2: Backfill existing profiles without a country (default to BE for NCV Management SRL)
UPDATE profiles SET country = 'BE' WHERE country IS NULL;

-- Step 3: Add NOT NULL constraint
ALTER TABLE profiles ALTER COLUMN country SET NOT NULL;

-- Step 4: Add CHECK constraint for 2-char uppercase code
ALTER TABLE profiles ADD CONSTRAINT chk_country_format CHECK (length(country) = 2 AND country = upper(country));

COMMENT ON COLUMN profiles.country IS 'ISO 3166-1 alpha-2 country code (EU/EEE + CH only)';
