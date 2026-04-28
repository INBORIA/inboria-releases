-- =====================================================================
-- Suppression du multi-canal client (WhatsApp + SMS)
-- Date: 2026-04-28
--
-- Contexte: Multi-canal supprime pour recentrer Inboria sur email + IA.
--
-- Raisons strategiques:
--  1. WhatsApp Business API: Meta TOS interdit l'hebergement mutualise
--     d'un editeur SaaS. Chaque client doit ouvrir son Meta Business
--     Manager et faire verifier sa societe (3-7 jours). Friction
--     d'onboarding incompatible avec la cible PME non-technique.
--  2. SMS Brevo = envoi seul. Pas de "boite unifiee" possible.
--  3. SMS Twilio = bidirectionnel mais BYOK obligatoire pour coherence
--     avec WhatsApp. Modele BYOK incoherent avec le modele Credits/PAYG
--     d'Inboria pour l'IA.
--  4. Reduction du scope produit pour se concentrer sur le vrai
--     differenciateur: l'autopilot email avec credits IA inclus.
--
-- Tables supprimees:
--  - public.messages           (messages WhatsApp/SMS unifies entrants/sortants)
--  - public.messaging_channels (config canaux client: numero, provider, creds)
--
-- CASCADE: requis pour les contraintes FK eventuelles (messages -> channels).
-- =====================================================================

DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.messaging_channels CASCADE;
