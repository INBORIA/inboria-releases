-- Phase 4: Email Assignments
-- Add assigned_to and assigned_at columns to emails table
-- Run this in Supabase SQL Editor

ALTER TABLE public.emails ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.emails ADD COLUMN IF NOT EXISTS assigned_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_emails_assigned_to ON public.emails(assigned_to);
