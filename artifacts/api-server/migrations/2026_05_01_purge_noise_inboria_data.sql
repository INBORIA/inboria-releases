-- Purge contextual memory rows extracted from transactional/noreply senders.
-- Before this migration, the inboria-extractor processed every incoming email
-- including welcome / verification / receipt mails sent by automated systems
-- (noreply@, notifications@, mailer-daemon, etc.). The resulting facts and
-- episodes were noise: they treated bots as "contacts" and polluted Inboria's
-- answers about real people. The extractor is now guarded by isNoiseEmail()
-- before the LLM call (services/inboria-extractor.ts), but historical rows
-- need to be cleaned up so the assistant stops referencing them.
--
-- Safe to re-run: pattern matches are deterministic and only delete rows
-- whose contact_email obviously belongs to a no-reply / automated sender.
--
-- ROLLBACK :
-- Cette migration est un DELETE pur, il n'existe pas de rollback "naturel"
-- (les lignes effacees etaient deja du bruit, on ne les recree pas). Si on
-- veut reproduire l'etat anterieur pour audit, restaurer depuis une
-- sauvegarde Supabase Point-In-Time Recovery anterieure a l'execution
-- de cette migration. Aucune contrainte FK n'est cassee : les colonnes
-- source_email_id sont nullables et le DELETE ne touche aucune autre
-- table que inboria_facts / inboria_episodes / inboria_signals.

BEGIN;

DELETE FROM inboria_facts
WHERE contact_email ~* '(noreply|no-reply|no\.reply|donotreply|do-not-reply|notification|notifications@|mailer-daemon|postmaster|automated@|alerts?@|info-noreply)';

DELETE FROM inboria_episodes
WHERE contact_email ~* '(noreply|no-reply|no\.reply|donotreply|do-not-reply|notification|notifications@|mailer-daemon|postmaster|automated@|alerts?@|info-noreply)';

-- inboria_signals may not exist yet on every environment (its own migration
-- 2026_04_30_inboria_signals.sql may have been applied in Supabase Dashboard
-- after this one). Use a defensive DO block so the purge does not fail when
-- the table is absent.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inboria_signals') THEN
    DELETE FROM inboria_signals
    WHERE contact_email ~* '(noreply|no-reply|no\.reply|donotreply|do-not-reply|notification|notifications@|mailer-daemon|postmaster|automated@|alerts?@|info-noreply)';
  END IF;
END$$;

COMMIT;
