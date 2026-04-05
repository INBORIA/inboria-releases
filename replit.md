# NCV Mail — Email Autopilot SaaS

## Overview

NCV Mail is a B2B SaaS "Email Autopilot" for SMEs, freelancers, and professionals in Belgium/France. The AI automatically reads, sorts, prioritizes, and categorizes emails.

## Architecture (3 systems)

1. **Hostinger** (ncvmail.com) — Marketing site vitrine (already done, don't touch)
2. **Replit** (app.ncvmail.com) — Application dashboard (React + Express API)
3. **Supabase** (ecdwevvisbrcsomdiqop.supabase.co) — Database + Authentication

Replit connects TO Supabase. No local database.

## Stack

- **Monorepo**: pnpm workspaces, TypeScript 5.9
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui, wouter routing
- **Backend**: Express 5 API server (proxy to Supabase)
- **Database**: Supabase PostgreSQL (external)
- **Auth**: Supabase Auth (email+password)
- **AI**: OpenAI gpt-4o-mini via Replit AI Integration
- **API codegen**: Orval from OpenAPI spec

## Auth Flow

- Frontend uses `@supabase/supabase-js` for login/signup directly
- Supabase session provides JWT access_token
- Frontend sends `Authorization: Bearer <token>` to API server
- API server validates token via `supabaseAdmin.auth.getUser(token)`
- Token getter set via `setAuthTokenGetter()` in custom-fetch

## Design System — Dark Theme

Dark-only theme inspired by Linear/Superhuman:
- **Background**: `#0d1117` (HSL 220 40% 7%)
- **Card**: `#141c2b` (HSL 225 25% 12%)
- **Sidebar**: `#0f1623` (HSL 220 33% 11%)
- **Primary blue**: `#2d7dd2` (HSL 210 65% 50%)
- **Muted text**: `#8b9cb3` (HSL 216 18% 62%)
- **Border**: `#1f2937` (HSL 217 25% 18%)
- **Hover card**: `#1a2235` (HSL 222 34% 15%)
- **Active sidebar**: `#1e3a5f` (HSL 215 45% 18%)
- **Font**: Inter
- Priority badges: Red (urgent), Amber (moyen), Emerald (faible)

## Email Integration

- **Gmail**: OAuth2 flow via Google APIs, popup-based auth
- **Outlook**: OAuth2 flow via Microsoft Graph API (needs MICROSOFT_CLIENT_ID/SECRET)
- **IMAP**: Generic provider support (Orange, Free, SFR, Yahoo, etc.)
- **AI Triage**: GPT-4o-mini classifies each email during sync (priority + summary + category)
- **Force re-sync**: Deletes all emails then re-downloads with AI triage
- **Sender parsing**: `parseSender()` helper splits "Name <email>" format

## Auto-Sync (background email sync)

Automatic email synchronization built into the server — no external service needed (Make.com not required).

- **Interval**: Every 5 minutes, checks all connected email accounts for new emails
- **Providers**: Gmail (OAuth2), Outlook (Microsoft Graph), IMAP (generic)
- **Processing**: Each new email → AI triage (GPT-4o-mini) → priority + category + summary + task extraction
- **Deduplication**: via external_id (Gmail message ID, Outlook message ID, IMAP UID)
- **Token refresh**: Automatic refresh of expired OAuth tokens (Google + Microsoft)
- **Quota**: Respects user email quota (emails_used vs emails_quota)
- **Startup**: Runs 10s after server boot, then every 5 minutes
- **File**: `artifacts/api-server/src/services/auto-sync.ts`

## Webhook (supplementary real-time ingestion)

Optional webhook for external integrations. Flow: External source -> Webhook NCV Mail -> GPT-4o mini -> Supabase

- **Single email**: `POST /api/webhook/email` — processes one email with AI triage + task extraction
- **Batch**: `POST /api/webhook/email/batch` — processes up to 50 emails at once
- **Test**: `GET /api/webhook/test` — verify webhook is active
- **Auth**: Header `x-webhook-secret` or `Authorization: Bearer <secret>` with WEBHOOK_SECRET env var
- **Payload**: `{ sender, subject, body, user_email, external_id?, received_at? }`
- **Response**: `{ status, emailId, priority, category, summary, tasksCreated }`
- **Features**: duplicate detection (via external_id), quota enforcement, auto task extraction, quota increment
- **File**: `artifacts/api-server/src/routes/webhook.ts`

## Supabase Tables

- `categories` (id uuid, created_at, user_id, name, description) — EXISTS
- `emails` (id uuid, created_at, user_id, category_id, project_id, sender, subject, body, status, priority TEXT DEFAULT 'faible', summary TEXT, external_id) — EXISTS
- `email_connections` (id uuid, user_id, provider, email_address, access_token, refresh_token, created_at, last_synced_at) — EXISTS
- `profiles` (id uuid, created_at, full_name, plan, seats, emails_used, emails_quota, stripe_*) — EXISTS
- `projects` (id uuid, created_at, user_id, name, reference, description, status, color) — EXISTS
- `tasks` (id uuid, created_at, user_id, email_id, project_id, title, done, due_date) — EXISTS
- `ai_rules` (id uuid, user_id, sender_pattern, forced_priority, forced_category) — EXISTS
- `integrations` (id uuid, user_id, provider, access_token, workspace_name, channel_id, database_id, enabled, created_at) — NEEDS CREATION

## Pages (all French, dark theme)

- `/login`, `/signup` — Auth pages (dark card on dark background)
- `/dashboard` — Priority inbox with email cards, priority badges, categories sidebar
- `/dashboard/bilan` — Daily AI summary with score, urgencies, key emails, advice
- `/dashboard/taches` — Tasks extracted from emails, with tabs (A faire/Terminees/Toutes)
- `/dashboard/categories` — Category management with create/edit/delete
- `/dashboard/projets` — Project management: create/edit/delete projects, view linked emails/tasks
- `/dashboard/parametres` — Settings: email connections, Slack/Notion integrations, AI preferences, profile, notifications
- `/dashboard/abonnement` — Subscription plans (Gratuit 0€ / Solo 9€ / Pro 19€ / Business 9€/seat)
- 404 page — Dark themed "Page introuvable"

## AI Draft Reply

- **Endpoint**: `POST /api/ai/draft` accepts `{emailId}`, returns `{draft}`
- Uses gpt-4o-mini to generate professional reply drafts in French (professional tone)
- Context-aware: includes linked project name/ref/description and category
- Signs with user's first name from profile
- **Frontend**: "Reponse IA" button (Wand2 icon) in email detail view, opens reply form and pre-fills with AI-generated draft
- **OpenAPI**: `generateDraft` operation, `GenerateDraftBody`/`DraftResponse` schemas, `useGenerateDraft` React hook

## Email Send/Reply

- **Send endpoint**: `POST /api/emails/send` accepts `{to, subject, body, replyToEmailId?}`
- **Gmail**: Sends via Gmail API (raw MIME), supports reply threading via In-Reply-To header
- **Outlook**: Sends via Microsoft Graph sendMail endpoint with auto token refresh
- **IMAP**: Sends via SMTP (nodemailer), host auto-derived from IMAP host
- **Frontend**: "Nouveau" compose button + dialog in inbox toolbar, Reply button in email detail view
- **OpenAPI**: `sendEmail` operation, `SendEmailBody` schema, `useSendEmail` React hook

## Stripe Integration

- **Checkout**: `POST /api/stripe/checkout` accepts `{planId, seats?}`, creates Stripe Checkout session, returns `{url}`
- **Webhook**: `POST /api/stripe/webhook` handles `checkout.session.completed`, `invoice.paid`, `customer.subscription.deleted`, `customer.subscription.updated`
- **Portal**: `GET /api/stripe/portal` returns `{url}` for Stripe Customer Portal (manage subscription, cancel, update card)
- **Lazy init**: Stripe SDK initialized on first call (server runs without STRIPE_SECRET_KEY)
- **Raw body**: `express.json` verify callback saves raw body for webhook signature verification
- **Frontend**: Subscription page redirects to Stripe Checkout, shows "Gerer l'abonnement" button for paid plans
- **OpenAPI**: `createCheckoutSession`, `getStripePortal` operations, `CheckoutBody`/`CheckoutResponse`/`PortalResponse` schemas

## Slack & Notion Integrations (Pro plan)

- **Slack**: OAuth2 connect via `GET /api/integrations/slack/connect`, callback at `/api/integrations/slack/callback`
  - Sends formatted notification to configured Slack channel when urgent email detected by AI during auto-sync
  - Uses `chat:write`, `channels:read` scopes
- **Notion**: OAuth2 connect via `GET /api/integrations/notion/connect`, callback at `/api/integrations/notion/callback`
  - Creates task pages in configured Notion database when AI extracts tasks during auto-sync
  - Uses Notion API v2022-06-28, auto-discovers first database
- **CRUD**: `GET /api/integrations` (list), `PATCH /api/integrations/:provider` (toggle/update), `DELETE /api/integrations/:provider` (disconnect)
- **Plan gate**: Pro or Business plan required to connect integrations
- **Frontend**: Integrations section in Parametres page with connect/disconnect buttons and enable/disable toggles
- **Table**: `integrations` (id, user_id, provider, access_token, workspace_name, channel_id, database_id, enabled, created_at) — unique on (user_id, provider)
- **Env vars**: SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, NOTION_CLIENT_ID, NOTION_CLIENT_SECRET
- **Files**: `artifacts/api-server/src/routes/integrations.ts`, `artifacts/api-server/src/services/integrations.ts`

## API Routes (prefix: /api)

Auth, profile, emails (CRUD + send), categories, tasks, dashboard stats, AI triage/summary, email connections/sync, webhook, stripe (checkout/webhook/portal), integrations (Slack/Notion OAuth + CRUD)

## Environment Variables

- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase anon key (secret)
- `SUPABASE_SECRET_KEY` — Supabase service role key (secret)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Gmail OAuth2
- `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` — Outlook OAuth2 (PENDING)
- `WEBHOOK_SECRET` — Secret key for Make.com webhook authentication
- `AI_INTEGRATIONS_OPENAI_*` — Auto-provisioned by Replit
- `STRIPE_SECRET_KEY` — Stripe secret API key
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret
- `STRIPE_PRICE_SOLO` — Stripe Price ID for Solo plan (9€/mois)
- `STRIPE_PRICE_PRO` — Stripe Price ID for Pro plan (19€/mois)
- `STRIPE_PRICE_BUSINESS` — Stripe Price ID for Business plan (9€/siege/mois)
- `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` — Slack OAuth2 app credentials
- `NOTION_CLIENT_ID` / `NOTION_CLIENT_SECRET` — Notion OAuth2 integration credentials
- `FRONTEND_URL` — Frontend URL for OAuth redirect (defaults to REPLIT_DEV_DOMAIN)

## Key Commands

- `pnpm --filter @workspace/api-spec run codegen` — Regenerate API hooks
- `pnpm --filter @workspace/api-server run dev` — Run API server
