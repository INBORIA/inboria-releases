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

## Webhook (Make.com integration)

Real-time email processing via webhook. Flow: Email recu -> Make.com -> Webhook NCV Mail -> GPT-4o mini -> Supabase

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
- `emails` (id uuid, created_at, user_id, category_id, sender, subject, body, status, priority TEXT DEFAULT 'faible', summary TEXT, external_id) — EXISTS
- `email_connections` (id uuid, user_id, provider, email_address, access_token, refresh_token, created_at, last_synced_at) — EXISTS
- `profiles` (id uuid, created_at, full_name, plan, seats, emails_used, emails_quota, stripe_*) — EXISTS
- `tasks` (id uuid, created_at, user_id, email_id, title, done, due_date) — EXISTS

## Pages (all French, dark theme)

- `/login`, `/signup` — Auth pages (dark card on dark background)
- `/dashboard` — Priority inbox with email cards, priority badges, categories sidebar
- `/dashboard/bilan` — Daily AI summary with score, urgencies, key emails, advice
- `/dashboard/taches` — Tasks extracted from emails, with tabs (A faire/Terminees/Toutes)
- `/dashboard/categories` — Category management with create/edit/delete
- `/dashboard/parametres` — Settings: email connections, AI preferences, profile, notifications
- `/dashboard/abonnement` — Subscription plans (Gratuit 0€ / Solo 9€ / Pro 19€ / Business 9€/seat)
- 404 page — Dark themed "Page introuvable"

## API Routes (prefix: /api)

Auth, profile, emails, categories, tasks, dashboard stats, AI triage/summary, email connections/sync, webhook

## Environment Variables

- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase anon key (secret)
- `SUPABASE_SECRET_KEY` — Supabase service role key (secret)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Gmail OAuth2
- `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` — Outlook OAuth2 (PENDING)
- `WEBHOOK_SECRET` — Secret key for Make.com webhook authentication
- `AI_INTEGRATIONS_OPENAI_*` — Auto-provisioned by Replit

## Key Commands

- `pnpm --filter @workspace/api-spec run codegen` — Regenerate API hooks
- `pnpm --filter @workspace/api-server run dev` — Run API server
