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
- Multi-language support (37 langues — FR, EN, NL, DE, ES, IT, PT, PL, RO, SV, DA, FI, HU, CS, TR, JA, KO, VI, TH, ID, MS, EL, UK, ET, ZH, ZH-TW, LT, SR, RU, HE, AR, HR, SK, SL, LV, MT, BG — Hungarian uses formal Ön/önözés, Czech uses formal vykání/Vy, Turkish uses formal siz, Japanese uses formal です/ます調 + 敬語, Korean uses formal 합쇼체/하십시오체, Vietnamese uses formal Quý khách/Quý vị, Thai uses formal ท่าน + โปรด/กรุณา, Indonesian uses formal Bahasa baku Anda + silakan/mohon, Malay uses formal Bahasa Melayu baku anda + sila/mohon, Greek uses formal πληθυντικός ευγενείας εσείς/σας, Ukrainian uses formal Ви/Вас capitalized, Estonian uses formal Teie/Teid capitalized, Simplified Chinese uses formal 您 + 请 — mainland China conventions, NOT Traditional 繁體; Traditional Chinese (zh-TW) uses formal 您 + 請 — Taiwan conventions 設定/電郵/登入/帳戶/軟體/應用程式/網路, NEVER Simplified 简体; Lithuanian uses formal Jūs/Jus/Jūsų capitalized + prašome; Serbian uses formal Ви/Вас/Ваш capitalized + молимо — Cyrillic script ONLY, NEVER Latin, Matica srpska orthography Serbia conventions подешавања/налог/лозинка/сандуче; Russian uses formal Вы/Вас/Ваш capitalized + пожалуйста — modern orthography with ё, Russian guillemets «...» NOT „...“, Russia conventions настройки/аккаунт/пароль/почтовый ящик/входящие; Hebrew (he) uses Modern Israeli Hebrew, professional B2B tone — no T-V distinction, אנא/נא for polite requests, RTL script, written WITHOUT nikud, Hebrew gershayim ״ for abbreviations, native terminology דוא״ל/הגדרות/חשבון/סיסמה/תיבת דואר/דואר נכנס; Arabic (ar) uses Modern Standard Arabic / الفصحى ONLY — NEVER dialectal, formal B2B tone with respectful 2nd person plural أنتم/كم, يرجى/الرجاء for polite requests, RTL, written WITHOUT tashkeel, Arabic punctuation ، ؛ ؟, native terminology البريد الإلكتروني/الإعدادات/الحساب/كلمة المرور/صندوق البريد/البريد الوارد; Croatian (hr) uses formal Vi/Vas/Vam/Vaš capitalized + molimo — Latin script ONLY (NEVER Cyrillic), ijekavica only (tjedan/tisuća/vlak/kruh/mlijeko/vrijeme), Hrvatski pravopis Croatia conventions, NEVER Serbian/Bosnian variants, native terminology e-pošta/postavke/račun/lozinka/poštanski sandučić/pristigla pošta; Slovak (sk) uses formal vykanie Vy/Vás/Vám/Váš capitalized + prosím — Pravidlá slovenského pravopisu Slovakia conventions, NEVER Czech variants (týždeň/mesto/môže/lebo/iba), native terminology e-mail/nastavenia/účet/heslo/poštová schránka/doručená pošta/aplikácia; Slovenian (sl) uses formal vikanje Vi/Vas/Vam/Vaš capitalized + prosimo — Slovenski pravopis Slovenia conventions, č/š/ž diacritics, native terminology e-pošta/nastavitve/račun/geslo/poštni predal/prejeto/aplikacija; Latvian (lv) uses formal Jūs/Jums/Jūsu capitalized + lūdzu — Latviešu valodas aģentūra Latvia conventions, ā/ē/ī/ū macrons + č/ģ/ķ/ļ/ņ/š/ž, native terminology e-pasts/iestatījumi/pieteikties/konts/parole/pastkaste/iesūtne/lietotne; Maltese (mt) uses formal Inti/Tagħkom capitalized + jekk jogħġobkom — Il-Kunsill Nazzjonali tal-Ilsien Malti conventions, Latin script ONLY (only Semitic EU language in Latin script), ċ/ġ/ħ/ż diacritics + għ digraph, native terminology email/issettjar/idħol/kont/password/kaxxa tal-posta/inbox/applikazzjoni — Romance/English loanwords integrated into Semitic morphology are normal; Bulgarian (bg) uses formal Вие/Вас/Ви/Ваш capitalized + моля — Институт за български език conventions, Cyrillic script ONLY (NEVER Latin), South Slavic (no case system, definite article suffixes -ът/-та/-то/-те), native terminology имейл/електронна поща/настройки/вход/акаунт/парола/пощенска кутия/входящи/приложение).
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