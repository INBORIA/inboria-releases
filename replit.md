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
- **Stripe Integration**: Manages subscriptions, checkout, and customer portal with geographic restrictions and B2B VAT collection.
- **Integrations (Pro plan)**: Includes Slack for urgent email notifications and Notion for creating task pages from AI-extracted tasks.
- **Mobile App**: Developed with Expo, sharing API hooks and Supabase Auth, featuring a dark-only theme and tab-based navigation.
- **Organisation Layer (Business plan)**: Implements multi-tenancy with `organisations`, `organisation_members`, and `invitations` tables, supporting CRUD operations for organizations and member management.
- **Shared Mailboxes (Phase 2)**: Allows sharing email connections within an organization, with dedicated tables and API routes for management and email claiming.
- **Internal Comments (Phase 3)**: Enables users to add, edit, and delete comments on emails within the application, with access control.
- **Email Assignment (Phase 4)**: Allows assigning emails to specific users within an organization, with associated API routes and UI elements.
- **Notifications & Activity (Phase 5)**: Implements a notification system and activity logging for events like email assignment and comments, with a team dashboard.
- **Agenda/Calendar (Task #21)**: Provides appointment management with CRUD operations, AI detection of appointments from emails, and integration with the dashboard and mobile app.
- **Email Attachments (Phase 7)**: Supports handling email attachments during sync and sending, with on-demand retrieval from providers (no permanent storage).
- **Email Pagination (Phase 6)**: Implements server-side pagination for email lists and infinite scroll on the frontend for improved performance and user experience.

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

## External Dependencies

- **Supabase**: Primary database (PostgreSQL) and authentication service.
- **OpenAI**: GPT-4o-mini via Replit AI Integration for all AI-powered functionalities.
- **Google APIs**: For Gmail OAuth2 integration and sending emails.
- **Microsoft Graph API**: For Outlook OAuth2 integration and sending emails.
- **Stripe**: For subscription management, payment processing, and customer portal.
- **Slack API**: For integrating Slack notifications.
- **Notion API**: For integrating Notion task management.