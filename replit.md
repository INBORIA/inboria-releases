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
- Multi-language support (43 langues — FR, EN, NL, DE, ES, IT, PT, PL, RO, SV, DA, FI, HU, CS, TR, JA, KO, VI, TH, ID, MS, EL, UK, ET, ZH, ZH-TW, LT, SR, RU, HE, AR, HR, SK, SL, LV, MT, BG, NB, CA, GA, UR, HI, KM — Hungarian uses formal Ön/önözés, Czech uses formal vykání/Vy, Turkish uses formal siz, Japanese uses formal です/ます調 + 敬語, Korean uses formal 합쇼체/하십시오체, Vietnamese uses formal Quý khách/Quý vị, Thai uses formal ท่าน + โปรด/กรุณา, Indonesian uses formal Bahasa baku Anda + silakan/mohon, Malay uses formal Bahasa Melayu baku anda + sila/mohon, Greek uses formal πληθυντικός ευγενείας εσείς/σας, Ukrainian uses formal Ви/Вас capitalized, Estonian uses formal Teie/Teid capitalized, Simplified Chinese uses formal 您 + 请 — mainland China conventions, NOT Traditional 繁體; Traditional Chinese (zh-TW) uses formal 您 + 請 — Taiwan conventions 設定/電郵/登入/帳戶/軟體/應用程式/網路, NEVER Simplified 简体; Lithuanian uses formal Jūs/Jus/Jūsų capitalized + prašome; Serbian uses formal Ви/Вас/Ваш capitalized + молимо — Cyrillic script ONLY, NEVER Latin, Matica srpska orthography Serbia conventions подешавања/налог/лозинка/сандуче; Russian uses formal Вы/Вас/Ваш capitalized + пожалуйста — modern orthography with ё, Russian guillemets «...» NOT „...“, Russia conventions настройки/аккаунт/пароль/почтовый ящик/входящие; Hebrew (he) uses Modern Israeli Hebrew, professional B2B tone — no T-V distinction, אנא/נא for polite requests, RTL script, written WITHOUT nikud, Hebrew gershayim ״ for abbreviations, native terminology דוא״ל/הגדרות/חשבון/סיסמה/תיבת דואר/דואר נכנס; Arabic (ar) uses Modern Standard Arabic / الفصحى ONLY — NEVER dialectal, formal B2B tone with respectful 2nd person plural أنتم/كم, يرجى/الرجاء for polite requests, RTL, written WITHOUT tashkeel, Arabic punctuation ، ؛ ؟, native terminology البريد الإلكتروني/الإعدادات/الحساب/كلمة المرور/صندوق البريد/البريد الوارد; Croatian (hr) uses formal Vi/Vas/Vam/Vaš capitalized + molimo — Latin script ONLY (NEVER Cyrillic), ijekavica only (tjedan/tisuća/vlak/kruh/mlijeko/vrijeme), Hrvatski pravopis Croatia conventions, NEVER Serbian/Bosnian variants, native terminology e-pošta/postavke/račun/lozinka/poštanski sandučić/pristigla pošta; Slovak (sk) uses formal vykanie Vy/Vás/Vám/Váš capitalized + prosím — Pravidlá slovenského pravopisu Slovakia conventions, NEVER Czech variants (týždeň/mesto/môže/lebo/iba), native terminology e-mail/nastavenia/účet/heslo/poštová schránka/doručená pošta/aplikácia; Slovenian (sl) uses formal vikanje Vi/Vas/Vam/Vaš capitalized + prosimo — Slovenski pravopis Slovenia conventions, č/š/ž diacritics, native terminology e-pošta/nastavitve/račun/geslo/poštni predal/prejeto/aplikacija; Latvian (lv) uses formal Jūs/Jums/Jūsu capitalized + lūdzu — Latviešu valodas aģentūra Latvia conventions, ā/ē/ī/ū macrons + č/ģ/ķ/ļ/ņ/š/ž, native terminology e-pasts/iestatījumi/pieteikties/konts/parole/pastkaste/iesūtne/lietotne; Maltese (mt) uses formal Inti/Tagħkom capitalized + jekk jogħġobkom — Il-Kunsill Nazzjonali tal-Ilsien Malti conventions, Latin script ONLY (only Semitic EU language in Latin script), ċ/ġ/ħ/ż diacritics + għ digraph, native terminology email/issettjar/idħol/kont/password/kaxxa tal-posta/inbox/applikazzjoni — Romance/English loanwords integrated into Semitic morphology are normal; Bulgarian (bg) uses formal Вие/Вас/Ви/Ваш capitalized + моля — Институт за български език conventions, Cyrillic script ONLY (NEVER Latin), South Slavic (no case system, definite article suffixes -ът/-та/-то/-те), native terminology имейл/електронна поща/настройки/вход/акаунт/парола/пощенска кутия/входящи/приложение; Norwegian Bokmål (nb) uses standard 'du'/'deg'/'din' lowercase + vennligst — Språkrådet conventions, å/æ/ø, no T-V distinction in modern Norwegian, NEVER Nynorsk forms (jeg/ikke/hva), NEVER Danish spellings, native terminology e-post/innstillinger/logg inn/konto/passord/postkasse/innboks/applikasjon; Catalan (ca) uses formal Vostè/vostè (3rd person singular) + 2nd person plural -eu UI forms (feu/escriviu/seleccioneu) + si us plau — Institut d'Estudis Catalans Catalonia conventions, Central Catalan/Barcelona standard, l·l geminated (NEVER ll/l.l), à/è/é/í/ï/ò/ó/ú/ü/ç, NEVER Spanish (i not y, amb not con) NEVER Valencian (aquest not este), native terminology correu electrònic/configuració/inicia sessió/compte/contrasenya/bústia/safata d'entrada/aplicació; Irish (ga) uses formal sibh + bhur possessive + le do thoil/le bhur dtoil — An Caighdeán Oifigiúil Ireland conventions, síneadh fada á/é/í/ó/ú, séimhiú/urú mutations, NEVER Scottish Gaelic (Irish: tá/níl/agus NOT tha/chan eil/agus), native terminology ríomhphost/socruithe/logáil isteach/cuntas/pasfhocal/bosca poist/bosca isteach/feidhmchlár; Urdu (ur) uses formal آپ (aap, 2pl polite for both sg/pl) + -یں/-ئیں imperatives + براہ کرم — Pakistan/India literary conventions, Perso-Arabic Nastaliq script RTL ONLY (NEVER Devanagari NEVER Roman Urdu), Urdu punctuation ۔ ، ؟, NEVER informal تو/تم, native terminology ای میل/ترتیبات/لاگ ان/اکاؤنٹ/پاس ورڈ/میل باکس/ان باکس/ایپلیکیشن; Hindi (hi) uses formal आप (aap, 2pl polite for both sg/pl) + -इए/-एँ imperatives + कृपया — Mānak Hindi India conventions, Devanagari script ONLY (NEVER Perso-Arabic NEVER Hinglish/Roman), । or . punctuation, NEVER informal तू/तुम, native terminology ईमेल/सेटिंग्स/लॉग इन/खाता/पासवर्ड/मेलबॉक्स/इनबॉक्स/ऐप्लिकेशन; Khmer (km) uses formal លោក/លោកស្រី (M/F) + លោកអ្នក (gender-neutral) + សូម — Chuon Nath dictionary Cambodia conventions, Khmer script ONLY (NEVER Romanized), no spaces within phrases but spaces between clauses, ។ punctuation, native អ៊ីមែល/ការកំណត់/ចូល/គណនី/ពាក្យសម្ងាត់/ប្រអប់សំបុត្រ/សារចូល/កម្មវិធី).
- Mobile application.
- Admin team folder view with access logging and privacy controls.

## User preferences

I prefer simple language and detailed explanations. I want iterative development and will provide feedback at each stage. Ask before making major changes.

**TOUJOURS redémarrer automatiquement le workflow concerné après TOUTE modification de code (backend ET frontend, même si Vite est censé recharger). Ne jamais demander, ne jamais oublier, ne jamais supposer que le HMR suffit.**

## Gotchas

- **Supabase Migrations**: Ensure `migrations/2026_05_03_email_chunks.sql` is applied manually in Supabase Dashboard for Inboria Email Brain to function. The worker will pause if the table is missing.
- **Sync calendrier externe (RDV Phase 2)**: `artifacts/api-server/migrations/2026_05_10_appointments_external_sync.sql` doit être appliquée manuellement dans Supabase (ajoute `appointments.organizer_email`, `external_provider`, `external_id`, `calendar_account_id`, `last_synced_at`…). Sans ça le SELECT template du flow contre-proposition multi-créneaux échoue avec "column appointments.organizer_email does not exist", l'INSERT counter_proposed est skippé et les 3 propositions du groupe restent annulées sans nouvelle ligne en agenda.
- **Multi-créneaux RDV (groupe)**: appliquer manuellement `artifacts/api-server/migrations/2026_05_14_appointment_proposal_group.sql` dans Supabase (ajoute la colonne `appointments.proposal_group_id` + index partiel). Sans ça, l'envoi de plusieurs créneaux dans un seul mail (`/api/appointments/propose-multi`) échouera à l'INSERT.
- **Lien visio personnel (Teams/Meet)**: appliquer manuellement `artifacts/api-server/migrations/2026_05_15_personal_video_url.sql` dans Supabase (ajoute `profiles.personal_video_url`). Sans ça, le bouton "Enregistrer" du lien visio en paramètres ne persistera rien (silent ignore côté backend).
- **Mes dossiers (Task #294)**: appliquer manuellement `artifacts/api-server/migrations/2026_05_17_user_folders.sql` dans Supabase (crée `user_folders` + `email_folder_assignments`, RLS user_id). Sans ça, `/dashboard/dossiers` renverra une liste vide en silence et le hook `classifyEmailIntoUserFolders` (auto-sync) sera no-op (cache `hasFoldersTable()` côté backend).
- **Vue Partagées « type Missive »**: appliquer manuellement `artifacts/api-server/migrations/2026_05_16_shared_mailbox_tracking.sql` dans Supabase (ajoute `shared_mailboxes.tracking_started_at`). Sans ça, les filtres serveur « Statut » (Non traités / SLA dépassé / Reportés) sur la vue Partagées renverront aussi tout l'historique pré-connexion d'une boîte (un nouveau client serait noyé sous 2000 anciens mails). Le filtre « Tous » reste exhaustif dans tous les cas.
- **Inboria Email Brain Backfill**: After migration, trigger the backfill process for existing tenants via the admin API.
- **AI Cost Management**: Be mindful of `EMAIL_EMBED_DAILY_BUDGET_USD` to control embedding costs.

## Pointers

- [Supabase Documentation](https://supabase.com/docs)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Paddle Documentation](https://developer.paddle.com/docs)
- [React Documentation](https://react.dev/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [shadcn/ui Documentation](https://ui.shadcn.com/)