# NCV Mail — Email Autopilot SaaS

## Overview

NCV Mail is a B2B SaaS "Email Autopilot" designed for SMEs, freelancers, and professionals in Belgium/France. Its core purpose is to automate email management by using AI to read, sort, prioritize, and categorize emails, streamlining communication and enhancing productivity for its users.

## User Preferences

I prefer simple language and detailed explanations. I want iterative development and will provide feedback at each stage. Ask before making major changes.

## System Architecture

The project employs a monorepo structure utilizing pnpm workspaces and TypeScript 5.9. The frontend is built with React, Vite, Tailwind CSS, and shadcn/ui, featuring wouter for routing. The backend is an Express 5 API server that acts as a proxy to Supabase.

### UI/UX Decisions

The design system is dark-only, inspired by Linear/Superhuman. It uses Inter font and a specific color palette including `#0d1117` for background, `#141c2b` for cards, and `#2d7dd2` as the primary blue. Priority badges are visually represented with Red (urgent), Amber (moyen), and Emerald (faible). The sidebar is compact with 12px navigation items and subtle active highlights. Email rows feature a left color bar indicating priority, circular blue avatars, Sparkles AI summary lines, and inline category/project badges. The inbox header includes a search bar, Autopilot status indicator, and pill-style priority filter buttons.

### Technical Implementations

- **Authentication**: Supabase Auth handles email+password signup and login, with API server JWT validation.
- **Email Integration**: Supports Gmail (OAuth2), Outlook (OAuth2), and generic IMAP providers. AI Triage, powered by GPT-4o-mini, classifies emails during sync, assigning priority, summary, and category.
- **Auto-Sync**: An internal server-side process automatically synchronizes emails every 5 minutes, performing AI triage, deduplication, and OAuth token refreshing.
- **Webhook**: Provides `POST /api/webhook/email` for real-time email ingestion and processing.
- **AI Features**: Includes functionalities for recategorizing uncategorized emails, drafting replies, summarizing conversations, detecting follow-ups, and generating follow-up emails, all powered by GPT-4o-mini.
- **Follow-ups**: Manages follow-up tracking with CRUD endpoints and status management.
- **CSV Export**: Provides endpoints for exporting emails, projects, follow-ups, and tasks data.
- **Email Sending**: Handles sending emails, supporting threading for Gmail, Microsoft Graph for Outlook, and SMTP for IMAP.
- **Paddle Integration**: Manages subscriptions via Paddle overlay checkout, webhooks, and customer portal with geographic restrictions and EU tax handling. Price IDs configured via env vars (`PADDLE_PRICE_SOLO`, `PADDLE_PRICE_PRO`, `PADDLE_PRICE_BUSINESS`). DB columns `stripe_customer_id`/`stripe_subscription_id` store Paddle IDs (legacy naming).
- **Payments Freeze (private beta)**: Paid subscriptions are temporarily frozen until the company bank account is open. Controlled by frontend env flag `VITE_PAYMENTS_ENABLED` (default `false`). When disabled: Paddle.js is not loaded (injected at runtime by `main.tsx` only when the flag is `true`), pricing CTAs and `/dashboard/abonnement` upgrade buttons display a "Coming soon" state, the cancel-subscription button is hidden, and visitors can join a waitlist via `POST /api/waitlist` (table `public.waitlist_signups`, migration `2026_04_22_waitlist_signups.sql`). Re-enable for launch by setting `VITE_PAYMENTS_ENABLED=true` in deployment secrets.
- **Integrations (Pro plan)**: Includes Slack for urgent email notifications and Notion for creating task pages from AI-extracted tasks.
- **Plateforme & écosystème (Vague 4 — Plus plan)**: Bidirectional CRM integrations (HubSpot, Pipedrive) with OAuth, contact/deal sync, and email logging as activities/notes. Public REST API at `/api/v1/*` authenticated via API keys (`Authorization: Bearer ibk_...`) with read/write scopes; outbound webhooks (`webhook_subscriptions`) signed with HMAC-SHA256 (`X-Inboria-Signature: sha256=...`) emit `email.received`, `task.created`, `appointment.created`, `rule.triggered` events to Zapier/Make/n8n. New "Plus" pricing tier (€29/month, 15k credits, includes CRM/API). UI: `/dashboard/parametres/integrations` page with CRM/Automation sections, accessible from `/dashboard/parametres`. Migration: `2026_04_24_v4_platform_ecosystem.sql`. SSRF protection on outbound webhooks (blocks loopback/RFC1918/link-local in production). i18n FR/EN/NL/DE/ES.
- **Multi-canal client (WhatsApp / SMS) — SUPPRIMÉ le 2026-04-28**: Décision stratégique de recentrer Inboria sur email + IA. Raisons: (1) WhatsApp Business API impose BYOK (Meta TOS interdit l'hébergement mutualisé), incompatible avec le modèle Credits/PAYG d'Inboria et avec la cible PME non-technique (vérification Meta Business 3-7 jours); (2) SMS Brevo = envoi seul, pas de boîte unifiée possible; (3) Onboarding multi-canal créait une friction prohibitive (2 semaines d'attente Meta + KYC Twilio). Code supprimé: routes `/api/messaging/*`, services `whatsapp.ts`/`sms.ts`, page `parametres-multi-canal.tsx`, hub card `multichannel`, section Communication dans intégrations, fields availability `whatsapp/sms_twilio/sms_brevo`, événement webhook `message.received`, clés i18n `messaging.*` + `settings.hub.multichannel*` (5 locales). Migration: `2026_04_28_drop_messaging_tables.sql` (DROP TABLE `messages` + `messaging_channels` CASCADE). Le code BYOK reste réintroduisible plus tard pour WhatsApp seul si besoin. `webhook-signatures.ts` conservé (utilisé par HubSpot/Pipedrive).
- **Mobile App**: Developed with Expo (Inboria-branded), sharing API hooks and Supabase Auth, featuring a dark-only theme and tab-based navigation. Full i18n (FR/EN/NL) using react-i18next with locale files in `i18n/locales/`. All screens use `useTranslation()` for dynamic language switching.
- **Organisation Layer (Business plan)**: Implements multi-tenancy with `organisations`, `organisation_members`, and `invitations` tables, supporting CRUD operations for organizations and member management.
- **Shared Mailboxes (Phase 2)**: Allows sharing email connections within an organization, with dedicated tables and API routes for management and email claiming.
- **Internal Comments (Phase 3)**: Enables users to add, edit, and delete comments on emails within the application, with access control.
- **Email Assignment (Phase 4)**: Allows assigning emails to specific users within an organization, with associated API routes and UI elements.
- **Notifications & Activity (Phase 5)**: Implements a notification system and activity logging for events like email assignment and comments, with a team dashboard.
- **Agenda/Calendar (Task #21)**: Provides appointment management with CRUD operations, AI detection of appointments from emails, and integration with the dashboard and mobile app.
- **AI Support Chatbot**: Floating chat widget ("?") in bottom-right of all dashboard pages. Uses GPT-4o-mini with a comprehensive knowledge base covering all 14 dashboard pages in FR/EN/NL. Endpoint: `POST /api/ai/support-chat` with entitlement check and per-user rate limiting (10 req/min). Knowledge base defined in `api-server/src/services/knowledge-base.ts`.
- **Email Attachments (Phase 7)**: Supports handling email attachments during sync and sending, with on-demand retrieval from providers (no permanent storage).
- **Email Pagination (Phase 6)**: Implements server-side pagination for email lists and infinite scroll on the frontend for improved performance and user experience.
- **Catégorie système "Non classé"**: Each user has exactly one protected fallback category (`categories.is_system = TRUE`, enforced by partial unique index per user). Created on demand by `ensureSystemCategory(userId)` (idempotent) and seeded for existing users on first GET `/api/categories`. On first creation, all orphan emails (`category_id IS NULL`) for that user are backfilled into it. PATCH/DELETE/merge of a system category return 400 `system_category_protected`; the UI surfaces dedicated toasts (`classification.systemCat.cannotRename` / `cannotDelete`) and pins this category to the top of the classement page with a grey "Système" badge, an orange "X à trier" counter, and a "Trier ces emails" link to the inbox. The `/api/ai/recategorize-uncategorized` endpoint reads emails from this bucket (plus legacy EN/NL "Uncategorized" cats), excludes them from the AI's candidate set, and routes any uncategorizable emails back to the system cat instead of leaving them orphan; only legacy junk cats can be auto-deleted when emptied. Migration: `artifacts/api-server/migrations/2026_04_26_categories_is_system.sql` (apply via Supabase Dashboard SQL Editor before the new code runs).

### Feature Specifications

- **Marketing Site**: Includes landing page, features, pricing, legal, and AI explanation.
- **Application Pages**:
    - `/dashboard`: Priority inbox, shared mailbox view, and trash.
    - `/dashboard/bilan`: Daily AI summary.
    - `/dashboard/taches`: Task management.
    - `/dashboard/classement`: Email classification and category management.
    - `/dashboard/envoyes`: Sent emails with conversation threading.
    - `/dashboard/suivi`: Follow-up tracking.
    - `/dashboard/projets`: Project management.
    - `/dashboard/equipe`: Team management (Business plan only).
    - `/dashboard/parametres`: User settings and integrations.
    - `/dashboard/abonnement`: Subscription management.
    - `/dashboard/agenda`: Calendar for appointments.
    - `/dashboard/activite-equipe`: Team activity dashboard (Business plan only).
    - `/dashboard/parametres/templates`: AI-contextual reply templates (CRUD, variable detection, AI auto-categorization, suggestions on reply).
    - `/dashboard/parametres/regles`: Automation rules (NL→JSON via GPT, simulator on last 100 emails, 24h audit + rollback).
- **Templates & Automation Rules (Task #104, Vague 2)**: Tables `email_templates`, `automation_rules`, `rule_executions_audit` (migration `2026_04_24_templates_and_automation_rules.sql`). The api-server attempts auto-apply on boot via the `exec_sql` RPC; if the RPC is not provisioned on the Supabase project, run the SQL migration manually in the Supabase SQL editor before using these features. Backend services in `artifacts/api-server/src/services/automation-rules.ts` (heuristic + GPT NL parser, condition matcher, action runner) and routes `routes/templates.ts` + `routes/automation-rules.ts`. Mobile composer integrates a template picker (`artifacts/ncv-mail-mobile/app/email/[id].tsx`).

## External Dependencies

- **Supabase**: Primary database (PostgreSQL) and authentication service.
- **OpenAI**: GPT-4o-mini via Replit AI Integration for all AI-powered functionalities.
- **Google APIs**: For Gmail OAuth2 integration and sending emails.
- **Microsoft Graph API**: For Outlook OAuth2 integration and sending emails.
- **Paddle**: For subscription management, payment processing (overlay checkout), and customer portal.
- **Slack API**: For integrating Slack notifications.
- **Notion API**: For integrating Notion task management.