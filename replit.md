# NCV Mail — Email Autopilot SaaS

## Overview

NCV Mail is a B2B SaaS "Email Autopilot" designed for SMEs, freelancers, and professionals in Belgium/France. Its core purpose is to automate email management by using AI to read, sort, prioritize, and categorize emails, streamlining communication and enhancing productivity for its users. The project aims to provide a comprehensive, AI-powered solution for efficient email handling.

## User Preferences

I prefer simple language and detailed explanations. I want iterative development and will provide feedback at each stage. Ask before making major changes.

## System Architecture

The project employs a monorepo structure utilizing pnpm workspaces and TypeScript. The frontend is built with React, Vite, Tailwind CSS, and shadcn/ui, featuring wouter for routing. The backend is an Express API server that acts as a proxy to Supabase.

### UI/UX Decisions

The design system is dark-only, inspired by Linear/Superhuman. It uses Inter font and a specific color palette. Priority badges are visually represented with Red (urgent), Amber (medium), and Emerald (low). The sidebar is compact, and email rows feature a left color bar indicating priority, circular avatars, AI summary lines, and inline category/project badges. The inbox header includes a search bar, Autopilot status indicator, and pill-style priority filter buttons.

### Technical Implementations

- **Authentication**: Supabase Auth handles email+password signup and login, with API server JWT validation.
- **Email Integration**: Supports Gmail (OAuth2), Outlook (OAuth2), and generic IMAP providers. AI Triage, powered by GPT-4o-mini, classifies emails during sync, assigning priority, summary, and category.
- **Auto-Sync**: An internal server-side process automatically synchronizes emails, performs AI triage, deduplication, and OAuth token refreshing.
- **Webhook**: Provides `POST /api/webhook/email` for real-time email ingestion and processing.
- **AI Features**: Includes functionalities for recategorizing uncategorized emails, drafting replies, summarizing conversations, detecting and generating follow-up emails, all powered by GPT-4o-mini.
- **Follow-ups**: Manages follow-up tracking with CRUD endpoints and status management, focusing on emails sent from the application.
- **CSV Export**: Provides endpoints for exporting emails, projects, follow-ups, and tasks data.
- **Email Sending**: Handles sending emails, supporting threading for Gmail, Microsoft Graph for Outlook, and SMTP for IMAP.
- **Paddle Integration**: Manages subscriptions via Paddle overlay checkout, webhooks, and customer portal with geographic restrictions and EU tax handling.
- **Integrations (Pro plan)**: Includes Slack for urgent email notifications and Notion for creating task pages from AI-extracted tasks.
- **Plateforme & écosystème (Plus plan)**: Bidirectional CRM integrations (HubSpot, Pipedrive) with OAuth, contact/deal sync, and email logging. Public REST API authenticated via API keys with read/write scopes; outbound webhooks signed with HMAC-SHA256 emit events to Zapier/Make/n8n. Includes i18n for FR/EN/NL/DE/ES.
- **Mobile App**: Developed with Expo (Inboria-branded), sharing API hooks and Supabase Auth, featuring a dark-only theme and tab-based navigation. Full i18n using react-i18next.
- **Organisation Layer (Business plan)**: Implements multi-tenancy with `organisations`, `organisation_members`, and `invitations` tables, supporting CRUD operations for organizations and member management.
- **Inboria Memory**: Contextual memory per contact for Contact 360°, using `inboria_facts`, `inboria_episodes` and `inboria_signals` tables. A worker extracts facts, episodes and signals from emails using GPT-4o-mini and text-embedding-3-small, storing embeddings. The worker honors the `inboria_enabled` flag on `email_connections` and `shared_mailboxes` (skips disabled mailboxes). Endpoints: `GET /api/inboria/context` (per-contact view), `GET/PATCH /api/inboria/mailbox-settings` (per-mailbox privacy toggle, ownership-checked), `POST /api/inboria/chat` (conversational chat with the assistant, scoped to user's facts/episodes/projects, costs `inboria_chat=1` credit). The memory is injected into AI draft prompts via `buildInboriaContextBlock` (helper in `artifacts/api-server/src/lib/inboria-prompt.ts`), used by `POST /ai/draft` (sender-based) and `POST /ai/follow-up-draft` (recipient-based). The chat is exposed in the dashboard header (left of the autopilot indicator) via `InboriaChatButton` (Sheet panel), translated in fr/en/nl/de/es.
- **Inboria Vocabulary Audit (Phase 5)**: Dashboard UI uses "Inboria" as the single brand entity instead of generic "AI/IA/KI" or the "Autopilot" sub-brand. Re-branded across FR/EN/NL/DE/ES locales: `autopilot.*` block (header indicator title, panel, status, ready/justActed/todayDone messages) → "Inboria"; action labels (`aiReply`, `aiForward`, `aiSummary`, `aiDetection`, `aiDetectionDesc`, `draftGenerated`, `archivedByAI`, `noFollowupsAlt`) → "Inboria"; dashboard subtitles (`brief.subtitle`, `brief.aiDailyBrief`, `brief.analyzing`, `tasks.noTasksDesc`, `tasks.sourceAi`, `parametres.subtitle`, support subtitle, rules subtitle) → "Inboria". The mobile-only span "Autopilot" inside `autopilot-indicator.tsx` was also changed to "Inboria". Marketing pages (accueil/fonctionnalites/animated-demo) intentionally keep the "Inboria — l'Email Autopilot" tagline as product positioning. Billing strings keep "Crédits IA" / "AI credits" / "KI-Credits" since they map to the documented credit system on the subscription page.
- **Inboria Expert Suggestion (Phase 4)**: For incoming emails in shared mailboxes, `GET /api/inboria/expert-suggestion?emailId=X` returns the team member best suited to handle the email, based on the contact's interaction history with each member (count of past emails this member has claimed/been assigned for the same `sender` in the same `shared_mailbox_id`, weighted at +3 each, plus +2 if the last interaction is within 30 days). Returns `null` when (a) the email is on a personal mailbox, (b) the email is outbound (`sent_at` set), (c) the requester is solo on the mailbox, or (d) the top score is below 3. The Email Detail view shows a clickable Sparkles banner above the assignment dropdown — "Inboria recommande [Name] · lui assigner" — that auto-assigns on click. Self-suggestions and already-assigned emails hide the banner. i18n FR/EN/NL/DE/ES under `inboriaExpert.*`.

- **Inboria Smart Sort (Phase 3)**: `GET /api/emails?sort=smart` returns emails ordered by an Inboria strategic score derived from `inboria_signals` (kinds: `awaiting_response`, `commitment_pending`, `decision_needed`, `escalation`, severity 1-3). To rank globally (not intra-page), the endpoint pulls a wider candidate window of up to 1000 most-recent matching emails, scores them all, sorts by score desc + recency tiebreak, and slices the requested page. Each email exposes `inboriaScore` and `inboriaReasons`. The inbox toolbar exposes a Sparkles-icon "Tri Inboria" toggle (persisted in `localStorage` `inbox.smartSort`, default ON); when active, the legacy priority/date sort is disabled and a "Stratégique" badge appears on rows with score ≥ 3 (tooltip lists the reasons). The endpoint silently falls back to `created_at` ordering if the `inboria_signals` table is missing. The worker probes the table at the start of each run and PAUSES the entire run if missing (apply `migrations/2026_04_30_inboria_signals.sql` in Supabase Dashboard) so the backlog is preserved and signals can be backfilled with facts/episodes once the migration is applied.
- **Shared Mailboxes**: Allows sharing email connections within an organization, with API routes for management and email claiming.
- **Internal Comments**: Enables users to add, edit, and delete comments on emails within the application, with access control.
- **Email Assignment**: Allows assigning emails to specific users within an organization, with associated API routes and UI elements.
- **Notifications & Activity**: Implements a notification system and activity logging for events, with a team dashboard.
- **Agenda/Calendar**: Provides appointment management with CRUD operations, AI detection of appointments from emails, and integration with the dashboard and mobile app.
- **AI Support Chatbot**: Floating chat widget powered by GPT-4o-mini with a knowledge base covering dashboard pages.
- **Email Attachments**: Supports handling email attachments during sync and sending, with on-demand retrieval from providers.
- **Email Pagination**: Implements server-side pagination for email lists and infinite scroll on the frontend.
- **Système "Non classé" Category**: Each user has a protected fallback category for unclassified emails, created on demand. Orphan emails are backfilled into it, and AI processing routes uncategorizable emails back to this system category.
- **Templates & Automation Rules**: Includes `email_templates` and `automation_rules` for creating and managing automated responses and actions based on email content, parsed via GPT.

### Feature Specifications

- **Marketing Site**: Includes landing page, features, pricing, legal, and AI explanation.
- **Application Pages**: Comprehensive set of dashboard pages for:
    - Inbox (priority, shared, trash)
    - Daily AI summary
    - Task management
    - Email classification and category management
    - Sent emails
    - Follow-up tracking
    - Project management
    - Team management (Business plan only)
    - User settings and integrations
    - Subscription management
    - Calendar for appointments
    - Team activity dashboard (Business plan only)
    - AI-contextual reply templates
    - Automation rules

## External Dependencies

- **Supabase**: Primary database (PostgreSQL) and authentication service.
- **OpenAI**: GPT-4o-mini via Replit AI Integration for all AI-powered functionalities.
- **Google APIs**: For Gmail OAuth2 integration and sending emails.
- **Microsoft Graph API**: For Outlook OAuth2 integration and sending emails.
- **Paddle**: For subscription management, payment processing, and customer portal.
- **Slack API**: For integrating Slack notifications.
- **Notion API**: For integrating Notion task management.