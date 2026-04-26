-- Étend les contraintes CHECK provider sur les tables CRM pour autoriser 'odoo'
-- en plus de 'hubspot', 'pipedrive' et 'salesforce'. Sans ce patch, syncOdooContacts /
-- syncOdooDeals / les inserts du cockpit échouent silencieusement
-- (constraint violation crm_contacts_provider_check / crm_deals_provider_check /
-- crm_email_logs_provider_check) et le panneau Odoo reste vide.
--
-- Spécificité Odoo : pas d'OAuth. L'utilisateur fournit URL + base + login + clé API
-- (générée dans Odoo > Profile > Account Security > New API Key). Ces credentials
-- sont stockés dans integrations.access_token (apiKey) et integrations.settings
-- ({url, db, login, uid}). Aucune nouvelle colonne nécessaire.

ALTER TABLE public.crm_contacts
  DROP CONSTRAINT IF EXISTS crm_contacts_provider_check;
ALTER TABLE public.crm_contacts
  ADD CONSTRAINT crm_contacts_provider_check
  CHECK (provider IN ('hubspot', 'pipedrive', 'salesforce', 'odoo'));

ALTER TABLE public.crm_deals
  DROP CONSTRAINT IF EXISTS crm_deals_provider_check;
ALTER TABLE public.crm_deals
  ADD CONSTRAINT crm_deals_provider_check
  CHECK (provider IN ('hubspot', 'pipedrive', 'salesforce', 'odoo'));

ALTER TABLE public.crm_email_logs
  DROP CONSTRAINT IF EXISTS crm_email_logs_provider_check;
ALTER TABLE public.crm_email_logs
  ADD CONSTRAINT crm_email_logs_provider_check
  CHECK (provider IN ('hubspot', 'pipedrive', 'salesforce', 'odoo'));
