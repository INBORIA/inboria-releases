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
- **Inboria Memory**: Contextual memory per contact for Contact 360°, using `inboria_facts` and `inboria_episodes` tables. A worker extracts facts and episodes from emails using GPT-4o-mini and text-embedding-3-small, storing embeddings. The worker honors the `inboria_enabled` flag on `email_connections` and `shared_mailboxes` (skips disabled mailboxes). Endpoints: `GET /api/inboria/context` (per-contact view), `GET/PATCH /api/inboria/mailbox-settings` (per-mailbox privacy toggle, ownership-checked). The memory is injected into AI draft prompts via `buildInboriaContextBlock` (helper in `artifacts/api-server/src/lib/inboria-prompt.ts`), used by `POST /ai/draft` (sender-based) and `POST /ai/follow-up-draft` (recipient-based).
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