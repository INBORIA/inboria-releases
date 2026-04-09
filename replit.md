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
    - **Conversation Summary**: `POST /api/ai/conversation-summary` generates summaries of email threads.
    - **Detect Followups**: `POST /api/ai/detect-followups` analyzes emails to suggest needed follow-ups.
    - **Generate Relance**: `POST /api/ai/generate-relance` generates follow-up email drafts.
- **Follow-ups**: `followups` table with statuses (en_attente, relance, termine), linked to emails and projects. CRUD endpoints at `/api/followups`.
- **CSV Export**: `/api/export/emails` (supports `?status=` and `?id=` for thread-scoped export), `/api/export/projects`, `/api/export/followups`, `/api/export/tasks` endpoints for data export. Frontend uses authenticated fetch+blob download via `src/lib/export-utils.ts` (not `window.open`).
- **Email Sending**: `POST /api/emails/send` handles sending emails, supporting threading for Gmail and utilizing Microsoft Graph for Outlook, and SMTP for IMAP.
- **Stripe Integration**: Manages subscriptions via Stripe Checkout sessions (`POST /api/stripe/checkout`), webhooks for `checkout.session.completed`, `invoice.paid`, `customer.subscription.deleted`, `customer.subscription.updated`, and a customer portal (`GET /api/stripe/portal`). Geographic restriction enforced: only EU/EEE + Switzerland countries are allowed. Country is collected at signup, stored in `profiles.country`, and validated before Stripe checkout. Checkout includes: automatic_tax enabled, tax_id_collection for B2B VAT, billing_address_collection required, customer_update for address/name sync, EUR currency, French locale, card + SEPA debit payment methods. Customer creation includes country address from profile.
- **Integrations (Pro plan)**:
    - **Slack**: OAuth2 integration to send urgent email notifications to a configured channel.
    - **Notion**: OAuth2 integration to create task pages in Notion databases from AI-extracted tasks.
- **Mobile App**: Developed with Expo, utilizing the same `@workspace/api-client-react` hooks and Supabase Auth. It features a dark-only theme, tab-based navigation (Reception, Bilan, Taches, Projets, Menu), and screens for login, register, email detail, project detail, archives, categories, and subscription.

### Feature Specifications

- **Marketing Site**: Includes a landing page, features overview, classement (packs metiers), intelligence artificielle (AI explanation), enterprise, pricing, legal mentions, privacy policy, and terms of service.
- **Application Pages**:
    - `/dashboard`: Priority inbox with email cards and category sidebar.
    - `/dashboard/bilan`: Daily AI summary.
    - `/dashboard/taches`: Task management from extracted emails.
    - `/dashboard/classement`: Classification page with 56 profession packs (8 families) + AI custom pack generation + category management. Old `/dashboard/categories` redirects here.
    - `/dashboard/envoyes`: Sent emails page with conversation threading, AI conversation summary, project assignment, and CSV export.
    - `/dashboard/suivi`: Follow-up tracking with status management (en_attente, relance, termine), AI-detected followup suggestions, overdue indicators, CSV export, and full detail view with conversation thread, reply, AI draft, AI summary, notes editing, and per-conversation export.
    - `/dashboard/projets`: Project management with CSV export.
    - `/dashboard/equipe`: Organisation/team management (Business plan only). Members list, invite, role management.
    - `/dashboard/parametres`: Settings for email connections, integrations, AI preferences, profile, and notifications.
    - `/dashboard/abonnement`: Subscription management.
- **Organisation Layer (Business plan)**:
    - Tables: `organisations`, `organisation_members`, `invitations` + `organisation_id` on `profiles`.
    - API routes: CRUD org, invite members, accept/cancel invitations, manage roles.
    - SQL setup: `attached_assets/sql_organisations_setup.sql` (must be run in Supabase dashboard).
    - Stripe webhook auto-creates org on Business plan checkout.
    - Sidebar shows "Mon équipe" and "Boîtes partagées" nav items only for Business plan users.
- **Shared Mailboxes (Phase 2, refactored)**:
    - Tables: `shared_mailboxes` (with `connection_id` FK to `email_connections`), `shared_mailbox_members` + `shared_mailbox_id`, `claimed_by`, `claimed_at` columns on `emails`.
    - SQL setup: `attached_assets/sql_shared_mailboxes.sql` + migration `sql_multi_email_connections.sql` (must be run in Supabase dashboard).
    - `email_connections` table: UNIQUE constraint changed from `(user_id, provider)` to `(user_id, email_address)` to allow multiple connections per provider.
    - API routes: CRUD shared mailboxes, add/remove members, list emails, claim/unclaim emails. New: `GET /shared-mailboxes/admin-connections` returns admin's connected addresses with shared status.
    - Creating a shared mailbox now requires a `connectionId` (pointing to an existing email connection) instead of manual name/email entry.
    - Dashboard page at `/dashboard/boites-partagees`: admin sees their connected addresses and can "Partager" them with the team. Member management and email claim/unclaim unchanged.
    - `/dashboard/parametres`: disconnect now uses connection ID. Multiple connections of same provider allowed (e.g. 2 Gmail accounts).
- **Internal Comments (Phase 3)**:
    - Table: `email_comments` (linked to emails, with user_id author).
    - SQL setup: `attached_assets/sql_email_comments.sql` (must be run in Supabase dashboard).
    - API routes: GET/POST /emails/:id/comments, PUT/DELETE /emails/:id/comments/:commentId.
    - Reusable `EmailComments` component (`src/components/email-comments.tsx`) integrated in email detail view.
    - Access control: own emails + shared mailbox emails + same-org emails.
    - Users can add, edit, delete their own notes. Ctrl+Enter shortcut to send.
- **Email Assignment (Phase 4)**:
    - Columns: `assigned_to` (uuid FK to auth.users), `assigned_at` on `emails` table.
    - SQL setup: `attached_assets/sql_email_assignments.sql` (must be run in Supabase dashboard).
    - API routes: POST /emails/:emailId/assign, POST /emails/:emailId/unassign, GET /emails/assigned-to-me.
    - Route file: `artifacts/api-server/src/routes/assignments.ts`.
    - Assignment selector in EmailDetail (visible only for Business plan users with an organisation).
    - "Assigné" badge in email list for assigned emails.
    - Security: only org members can assign, unassign restricted to assignee/owner/admin.
- **Notifications & Activity (Phase 5)**:
    - Tables: `notifications`, `activity_logs` (SQL: `attached_assets/sql_phase5_notifications_activity.sql` — must be run in Supabase dashboard).
    - API routes: GET /notifications, GET /notifications/unread-count, PATCH /notifications/:id/read, POST /notifications/mark-all-read.
    - Team dashboard routes: GET /team/dashboard, GET /team/activity.
    - Helper module: `artifacts/api-server/src/lib/activity.ts` (createNotification, logActivity, getOrgIdForUser, getUserName).
    - Auto-notifications on: email assignment (to assignee), new comment (to email owner + assignee).
    - Activity logging on: assign, comment (for org members).
    - NotificationBell component in sidebar with dropdown, unread count badge, real-time polling (30s).
    - Team dashboard page at `/dashboard/activite-equipe` (Business plan only): member stats, recent activity feed.
    - Sidebar link "Activité équipe" visible only for Business plan users.

- **Agenda/Calendar (Task #21)**:
    - Table: `appointments` (id uuid PK, user_id, title, description, location, start_at, end_at, all_day, email_id, project_id, reminder_minutes, created_at, updated_at). SQL setup: `attached_assets/sql_appointments_setup.sql` (must be run in Supabase dashboard). Proper user-scoped RLS policies.
    - API routes (`routes/appointments.ts`): CRUD at `/appointments`, with `?from=&to=&projectId=` query filters. All responses mapped to camelCase.
    - AI detection: `POST /ai/detect-appointments` scans last 30 emails with GPT-4o-mini, extracts appointments, inserts them, returns camelCase.
    - CSV export: `GET /export/appointments` exports all user appointments.
    - Web dashboard: `/dashboard/agenda` with month/week/day views, create/edit/delete modals, AI detection button, CSV export. Sidebar link with CalendarDays icon.
    - Bilan integration: Today's appointments shown in bilan page with amber-bordered card and link to agenda.
    - Mobile: `app/(tabs)/agenda.tsx` tab with calendar grid and day appointment list. Registered in `_layout.tsx`.
    - i18n: `agenda` section with 35+ keys in all 3 locales (fr/en/nl).

- **Email Attachments (Phase 7)**:
    - Table: `email_attachments` (id uuid PK, email_id int FK→emails, filename, content_type, size, provider, provider_attachment_id, connection_id uuid, message_uid, created_at). Auto-created via `ensureEmailAttachmentsTable()` in index.ts.
    - Gmail sync: `extractGmailAttachments()` walks payload.parts, stores attachmentId for on-demand retrieval via `gmail.users.messages.attachments.get()`.
    - IMAP sync: `simpleParser` attachments metadata saved, message UID stored for re-fetch.
    - API routes (`routes/attachments.ts`): `GET /attachments/email/:emailId` (list), `GET /attachments/:id/download` (proxy download from Gmail/IMAP), `POST /attachments/upload` (multer temp), `DELETE /attachments/upload/cleanup`.
    - Email sending (`POST /emails/send`) supports attachments: Gmail uses MIME multipart/mixed, Outlook uses Graph API fileAttachment, IMAP/SMTP uses nodemailer attachments. Temp files cleaned after send.
    - Email list includes `attachmentCount`. Email detail includes `attachments[]` array. Conversation endpoint includes attachments per message.
    - Frontend: `AttachmentList` component (file icons, size, download, inline preview for images/PDF), `AttachmentBadge` (paperclip icon in email rows), `FileAttachInput` (upload button + file list with remove, used in reply & compose forms).
    - No permanent file storage — attachments fetched on-demand from provider.

- **Email Pagination (Phase 6)**:
    - Backend: `/api/emails` and `/api/shared-mailboxes/:mailboxId/emails` return paginated responses `{ emails, total, page, totalPages }` instead of plain arrays.
    - Query params: `page` (1-indexed, default 1) and `limit` (default 50, max 100).
    - Count query runs in parallel with data query for performance.
    - Frontend: Infinite scroll with IntersectionObserver. Emails accumulate in state as user scrolls. Filters/search reset to page 1.
    - Sidebar counters use server-provided `total` count, not loaded email count.
    - Archives page uses `status=archived` filter with limit 100.
    - OpenAPI schemas: `PaginatedEmails`, `PaginatedSharedMailboxEmails`.

## External Dependencies

- **Supabase**: Primary database (PostgreSQL) and authentication service.
- **OpenAI**: GPT-4o-mini via Replit AI Integration for all AI-powered email triage, summarization, categorization, and drafting functionalities.
- **Google APIs**: For Gmail OAuth2 integration and sending emails.
- **Microsoft Graph API**: For Outlook OAuth2 integration and sending emails.
- **Stripe**: For subscription management, payment processing, and customer portal.
- **Slack API**: For integrating Slack notifications.
- **Notion API**: For integrating Notion task management.