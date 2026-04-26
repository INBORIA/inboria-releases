-- Étend les contraintes CHECK provider sur les tables CRM pour autoriser 'salesforce'
-- en plus de 'hubspot' et 'pipedrive'. Sans ce patch, syncSalesforceContacts /
-- syncSalesforceDeals / les optimistic inserts du cockpit échouent silencieusement
-- (constraint violation crm_contacts_provider_check / crm_deals_provider_check /
-- crm_email_logs_provider_check) et le panneau Salesforce reste vide.

ALTER TABLE public.crm_contacts
  DROP CONSTRAINT IF EXISTS crm_contacts_provider_check;
ALTER TABLE public.crm_contacts
  ADD CONSTRAINT crm_contacts_provider_check
  CHECK (provider IN ('hubspot', 'pipedrive', 'salesforce'));

ALTER TABLE public.crm_deals
  DROP CONSTRAINT IF EXISTS crm_deals_provider_check;
ALTER TABLE public.crm_deals
  ADD CONSTRAINT crm_deals_provider_check
  CHECK (provider IN ('hubspot', 'pipedrive', 'salesforce'));

ALTER TABLE public.crm_email_logs
  DROP CONSTRAINT IF EXISTS crm_email_logs_provider_check;
ALTER TABLE public.crm_email_logs
  ADD CONSTRAINT crm_email_logs_provider_check
  CHECK (provider IN ('hubspot', 'pipedrive', 'salesforce'));
