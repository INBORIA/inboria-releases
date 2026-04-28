-- Migration: remove Slack from sla_policies.escalation default
-- Idempotent. Pure ALTER COLUMN ... SET DEFAULT (no type change, no data loss).
-- Safe to re-run.

ALTER TABLE sla_policies
  ALTER COLUMN escalation SET DEFAULT '{"email":true}'::jsonb;
