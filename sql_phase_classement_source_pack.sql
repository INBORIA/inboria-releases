-- Add source_pack column to categories table
-- Run this in Supabase SQL Editor as a single block

ALTER TABLE categories ADD COLUMN IF NOT EXISTS source_pack TEXT;
