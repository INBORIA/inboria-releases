# NCV Mail — Email Autopilot SaaS

## Overview

NCV Mail is a B2B SaaS "Email Autopilot" for SMEs, freelancers, and professionals in Belgium/France. The AI automatically reads, sorts, prioritizes, and categorizes emails. Built as a pnpm workspace monorepo using TypeScript.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **AI**: OpenAI gpt-4o-mini via Replit AI Integration
- **Build**: esbuild (CJS bundle)
- **Routing**: wouter (frontend)

## Architecture

### Artifacts
- **api-server** (`artifacts/api-server`): Express 5 API server with cookie-based auth, PostgreSQL, AI endpoints
- **ncv-mail** (`artifacts/ncv-mail`): React + Vite frontend SPA, all UI in French
- **mockup-sandbox** (`artifacts/mockup-sandbox`): Component preview server for design iteration

### Shared Libraries
- **lib/db**: Drizzle ORM schema and database client (users, categories, emails, tasks tables)
- **lib/api-spec**: OpenAPI spec + Orval codegen config
- **lib/api-client-react**: Generated React Query hooks and Zod schemas
- **lib/api-zod**: Generated Zod validation schemas

## Authentication

- Cookie-based auth with **signed httpOnly cookies** (using SESSION_SECRET)
- `cookie-parser` with signing secret for tamper detection
- Auth middleware reads `req.signedCookies.userId`
- Password hashing via Node.js built-in `crypto.scryptSync`

## Brand Colors

- Sidebar: `#1A3A5C` (navy)
- CTA buttons: `#1877F2` (blue)
- Background: `#FFFFFF`
- Secondary: `#F8FAFC`
- Text: `#2C3E50`
- Urgent: `#EF4444` (red)
- Medium: `#F59E0B` (orange)
- Low: `#10B981` (green)
- Font: Inter

## Pages (all in French)

- `/login` — Login page
- `/signup` — Registration page
- `/dashboard` — Priority inbox (Boite prioritaire)
- `/dashboard/bilan` — Daily AI summary (Bilan quotidien)
- `/dashboard/taches` — Task extraction view
- `/dashboard/categories` — Category management (CRUD)
- `/dashboard/parametres` — User settings
- `/dashboard/abonnement` — Subscription page (4 tiers: Gratuit/Solo/Pro/Business)

## API Routes (prefix: /api)

- `POST /api/auth/register` — Register new user
- `POST /api/auth/login` — Login
- `POST /api/auth/logout` — Logout
- `GET /api/auth/me` — Get current user
- `GET /api/profile` — Get user profile
- `PUT /api/profile` — Update profile
- `GET /api/emails` — List emails (with priority/category filters)
- `GET /api/emails/:id` — Get single email
- `PUT /api/emails/:id` — Update email
- `GET /api/categories` — List categories
- `POST /api/categories` — Create category
- `PUT /api/categories/:id` — Update category
- `DELETE /api/categories/:id` — Delete category
- `GET /api/tasks` — List tasks
- `PUT /api/tasks/:id` — Update task
- `GET /api/dashboard/summary` — Dashboard summary stats
- `GET /api/dashboard/inbox-health` — Inbox health score
- `GET /api/dashboard/category-counts` — Category email counts
- `POST /api/ai/triage` — AI email triage
- `POST /api/ai/daily-summary` — Generate daily AI summary

## Demo Account

- Email: `demo@ncvmail.com`
- Password: `demo123`

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/scripts run seed` — seed database with demo data

## Environment Variables

- `SESSION_SECRET` — Secret for signing session cookies
- `DATABASE_URL` — PostgreSQL connection string (auto-provisioned)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` — OpenAI proxy URL (auto-provisioned by Replit)
- `AI_INTEGRATIONS_OPENAI_API_KEY` — OpenAI proxy key (auto-provisioned by Replit)

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
