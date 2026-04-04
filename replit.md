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

## Brand Colors

- Sidebar: `#1A3A5C` (navy)
- CTA: `#1877F2` (blue)
- Background: `#FFFFFF`
- Secondary: `#F8FAFC`
- Text: `#2C3E50`
- Urgent: `#EF4444`, Medium: `#F59E0B`, Low: `#10B981`
- Font: Inter

## Supabase Tables

- `categories` (id uuid, created_at, user_id, name, description) — EXISTS
- `emails` (id uuid, created_at, user_id, category_id, sender, subject, body, status, priority, summary) — EXISTS
- `profiles` (id uuid, created_at, full_name, plan, seats, emails_used, emails_quota, stripe_*) — NEEDS CREATION
- `tasks` (id uuid, created_at, user_id, email_id, title, done, due_date) — NEEDS CREATION

## Pages (all French)

- `/login`, `/signup` — Auth pages
- `/dashboard` — Priority inbox
- `/dashboard/bilan` — Daily AI summary
- `/dashboard/taches` — Tasks
- `/dashboard/categories` — Category management
- `/dashboard/parametres` — Settings
- `/dashboard/abonnement` — Subscription (Gratuit/Solo/Pro/Business)

## API Routes (prefix: /api)

Auth, profile, emails, categories, tasks, dashboard stats, AI triage/summary

## Environment Variables

- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase anon key (secret)
- `SUPABASE_SECRET_KEY` — Supabase service role key (secret)
- `AI_INTEGRATIONS_OPENAI_*` — Auto-provisioned by Replit

## Key Commands

- `pnpm --filter @workspace/api-spec run codegen` — Regenerate API hooks
- `pnpm --filter @workspace/api-server run dev` — Run API server
