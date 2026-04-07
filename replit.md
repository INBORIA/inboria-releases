# NCV Mail — Email Autopilot SaaS

## Overview

NCV Mail is a B2B SaaS "Email Autopilot" designed for SMEs, freelancers, and professionals in Belgium/France. Its core purpose is to automate email management by using AI to read, sort, prioritize, and categorize emails, streamlining communication and enhancing productivity for its users.

## User Preferences

I prefer simple language and detailed explanations. I want iterative development and will provide feedback at each stage. Ask before making major changes.

## System Architecture

The project employs a monorepo structure utilizing pnpm workspaces and TypeScript 5.9. The frontend is built with React, Vite, Tailwind CSS, and shadcn/ui, featuring wouter for routing. The backend is an Express 5 API server that acts as a proxy to Supabase.

### UI/UX Decisions

The design system is dark-only, inspired by Linear/Superhuman. It uses Inter font and a specific color palette including `#0d1117` for background, `#141c2b` for cards, and `#2d7dd2` as the primary blue. Priority badges are visually represented with Red (urgent), Amber (moyen), and Emerald (faible). The sidebar is compact (200px wide) with 12px navigation items and subtle active highlights. Email rows feature a left color bar indicating priority, circular blue avatars, Sparkles AI summary lines, and inline category/project badges. The inbox header includes a search bar, Autopilot status indicator, and pill-style priority filter buttons.

### Technical Implementations

- **Authentication**: Supabase Auth handles email+password signup and login. The frontend interacts directly with `supabase.auth.signUp()` and `supabase.auth.signInWithPassword()`. Email verification redirects through `/auth/callback`. The API server validates JWTs via `supabaseAdmin.auth.getUser()`.
- **Email Integration**: Supports Gmail (OAuth2 via Google APIs), Outlook (OAuth2 via Microsoft Graph API), and generic IMAP providers. AI Triage, powered by GPT-4o-mini, classifies emails during sync, assigning priority, summary, and category.
- **Auto-Sync**: An internal server-side process automatically synchronizes emails every 5 minutes across connected accounts, performing AI triage, deduplication, and OAuth token refreshing.
- **Webhook**: Provides `POST /api/webhook/email` and `POST /api/webhook/email/batch` for real-time ingestion of single or batched emails, with AI processing and duplicate detection.
- **AI Features**:
    - **Recategorize Uncategorized**: `POST /api/ai/recategorize-uncategorized` re-analyzes uncategorized emails using GPT-4o-mini.
    - **Draft Reply**: `POST /api/ai/draft` generates context-aware, professional email replies in French using GPT-4o-mini.
- **Email Sending**: `POST /api/emails/send` handles sending emails, supporting threading for Gmail and utilizing Microsoft Graph for Outlook, and SMTP for IMAP.
- **Stripe Integration**: Manages subscriptions via Stripe Checkout sessions (`POST /api/stripe/checkout`), webhooks for `checkout.session.completed`, `invoice.paid`, `customer.subscription.deleted`, `customer.subscription.updated`, and a customer portal (`GET /api/stripe/portal`).
- **Integrations (Pro plan)**:
    - **Slack**: OAuth2 integration to send urgent email notifications to a configured channel.
    - **Notion**: OAuth2 integration to create task pages in Notion databases from AI-extracted tasks.
- **Mobile App**: Developed with Expo, utilizing the same `@workspace/api-client-react` hooks and Supabase Auth. It features a dark-only theme, tab-based navigation (Reception, Bilan, Taches, Projets, Menu), and screens for login, register, email detail, project detail, archives, categories, and subscription.

### Feature Specifications

- **Marketing Site**: Includes a landing page, features overview, pricing, legal mentions, privacy policy, and terms of service.
- **Application Pages**:
    - `/dashboard`: Priority inbox with email cards and category sidebar.
    - `/dashboard/bilan`: Daily AI summary.
    - `/dashboard/taches`: Task management from extracted emails.
    - `/dashboard/categories`: Category management.
    - `/dashboard/projets`: Project management.
    - `/dashboard/equipe`: Organisation/team management (Business plan only). Members list, invite, role management.
    - `/dashboard/parametres`: Settings for email connections, integrations, AI preferences, profile, and notifications.
    - `/dashboard/abonnement`: Subscription management.
- **Organisation Layer (Business plan)**:
    - Tables: `organisations`, `organisation_members`, `invitations` + `organisation_id` on `profiles`.
    - API routes: CRUD org, invite members, accept/cancel invitations, manage roles.
    - SQL setup: `attached_assets/sql_organisations_setup.sql` (must be run in Supabase dashboard).
    - Stripe webhook auto-creates org on Business plan checkout.
    - Sidebar shows "Mon équipe" nav item only for Business plan users.

## External Dependencies

- **Supabase**: Primary database (PostgreSQL) and authentication service.
- **OpenAI**: GPT-4o-mini via Replit AI Integration for all AI-powered email triage, summarization, categorization, and drafting functionalities.
- **Google APIs**: For Gmail OAuth2 integration and sending emails.
- **Microsoft Graph API**: For Outlook OAuth2 integration and sending emails.
- **Stripe**: For subscription management, payment processing, and customer portal.
- **Slack API**: For integrating Slack notifications.
- **Notion API**: For integrating Notion task management.