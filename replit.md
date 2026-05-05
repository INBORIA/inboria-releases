# NCV Mail

NCV Mail is an AI-powered SaaS "Email Autopilot" for SMEs, freelancers, and professionals, automating email management to streamline communication and enhance productivity.

## Run & Operate

```bash
pnpm install
pnpm dev # Starts frontend and backend
```

**Required Environment Variables:**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`
- `PADDLE_SECRET_KEY`
- `PADDLE_CLIENT_TOKEN`
- `SLACK_CLIENT_ID`
- `SLACK_CLIENT_SECRET`
- `NOTION_CLIENT_ID`
- `NOTION_CLIENT_SECRET`

## Stack

- **Frontend**: React, Vite, Tailwind CSS, shadcn/ui, wouter (routing)
- **Backend**: Express (Node.js), TypeScript
- **Database/Auth**: Supabase (PostgreSQL, Auth, MFA)
- **ORM**: _Populate as you build_
- **Validation**: _Populate as you build_
- **Build Tool**: pnpm (monorepo workspaces)
- **AI**: OpenAI GPT-4o-mini (via Replit AI Integration), text-embedding-3-small
- **Mobile**: Expo

## Where things live

- `/apps/frontend`: React application for the dashboard.
- `/apps/api-server`: Express API backend.
- `/apps/mobile`: Expo mobile application.
- `/packages/ui`: Shared UI components.
- `/packages/types`: Shared TypeScript types.
- `/packages/services`: Shared backend services/workers.
- `supabase/migrations`: Database schema migrations (source-of-truth for DB schema).
- `apps/api-server/src/routes`: API endpoint definitions.
- `packages/ui/src/theme`: Theme configuration.
- `apps/frontend/src/i18n`: Internationalization files.

## Architecture decisions

- **Monorepo with pnpm**: Centralized dependency management and shared code for frontend, backend, and mobile.
- **Supabase as BaaS**: Leverages Supabase for PostgreSQL, authentication, and real-time features, reducing custom backend development for core functionalities.
- **AI-first approach**: GPT-4o-mini integrated throughout for core features like email triage, drafting, summarization, and follow-up detection.
- **Dark-only UI**: Consistent brand aesthetic inspired by productivity tools like Linear and Superhuman.
- **Internal Workers for AI processing**: Dedicated services handle asynchronous tasks like email synchronization, AI triage, and embedding generation, ensuring responsiveness of the main application.

## Product

- AI-powered email triage (sort, prioritize, categorize, summarize).
- Automated email synchronization and deduplication.
- Multi-provider email integration (Gmail, Outlook, IMAP).
- AI-driven email drafting, reply suggestions, and follow-up management.
- Subscription management via Paddle.
- Integrations with Slack (notifications) and Notion (task creation).
- CRM integrations (HubSpot, Pipedrive) for Pro/Plus plans.
- Organizational features: shared mailboxes, team management, email assignment, internal comments.
- Contact 360° view with Inboria Memory (semantic search, facts, episodes, signals).
- Inboria Expert Suggestion for shared mailboxes.
- Inboria Smart Sort for strategic email ranking.
- AI Chatbot for support and contextual assistance.
- Multi-language support (FR, EN, NL, DE, ES, IT, PT, PL, RO, SV, DA, FI).
- Mobile application.
- Admin team folder view with access logging and privacy controls.

## User preferences

I prefer simple language and detailed explanations. I want iterative development and will provide feedback at each stage. Ask before making major changes.

## Gotchas

- **Supabase Migrations**: Ensure `migrations/2026_05_03_email_chunks.sql` is applied manually in Supabase Dashboard for Inboria Email Brain to function. The worker will pause if the table is missing.
- **Inboria Email Brain Backfill**: After migration, trigger the backfill process for existing tenants via the admin API.
- **AI Cost Management**: Be mindful of `EMAIL_EMBED_DAILY_BUDGET_USD` to control embedding costs.

## Pointers

- [Supabase Documentation](https://supabase.com/docs)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Paddle Documentation](https://developer.paddle.com/docs)
- [React Documentation](https://react.dev/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [shadcn/ui Documentation](https://ui.shadcn.com/)