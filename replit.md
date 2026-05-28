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

**Nom du produit : « Inboria »** (et non « NCV Mail »). NCV Mail = ancien nom historique encore présent dans les noms d'artifacts/workflows/dossiers (`artifacts/ncv-mail`, workflow « NCV Mail »…) — NE PAS renommer ces identifiants techniques (cassent les chemins, les workflows et l'historique git). Mais dans **toute communication produit, UI, copy, docs visibles utilisateur, emails, communication avec le user**, c'est **Inboria**. Quand le user dit « l'app » / « le produit », il parle d'Inboria.

**TOUJOURS redémarrer automatiquement le workflow concerné après TOUTE modification de code (backend ET frontend, même si Vite est censé recharger). Ne jamais demander, ne jamais oublier, ne jamais supposer que le HMR suffit.**

**JAMAIS proposer ou créer de tâche pour un autre agent (« Build in background » / task agent isolé). L'utilisateur veut que je fasse tout le travail moi-même, dans cet environnement, en Build mode. Si je suis en Plan mode, demander à l'utilisateur de repasser en Build mode plutôt que de créer une tâche projet.**

**Convention présentation lignes de mails (Réception, Envoyés, et toute future liste type Programmés / Reportés / Tâches / Archives / Partagées / Mes dossiers …) — ligne plate 52px, style Superhuman :**
- Container : `group relative flex items-center gap-3 h-[52px] pl-2 pr-3 cursor-pointer select-none border-l-2 border-b border-[color:var(--mail-border)] hover:border-b-[color:var(--mail-border-hover)] transition-colors`. Sélectionné = `border-l-primary bg-primary/[0.10]`, sinon `border-l-transparent hover:bg-white/[0.03]`.
- Colonnes dans l'ordre : (1) case à cocher 4×4 (visible uniquement en mode sélection ou si ligne sélectionnée, sinon zone cliquable invisible 3×3), (2) avatar rond 7×7 `bg-primary/15 border border-primary/30` avec **première lettre** de l'expéditeur/destinataire en `text-primary text-[11px] font-semibold` (JAMAIS d'icône Send/Reply/ArrowRight — ces flèches sont interdites comme avatar), (3) expéditeur/destinataire largeur fixe `w-[140px]` `text-[13px] truncate` (blanc gras si non-lu, `text-[color:var(--mail-text-read)] font-normal` si lu), (4) sujet flex-1 même style + `— extrait` en `text-[color:var(--mail-text-muted)]` (ou `text-[color:var(--mail-text-faint)]` si lu) + bouton catégorie `text-[11px] lowercase text-[color:var(--mail-text-meta)] hover:text-[color:var(--mail-text-meta-hover)] hover:underline`, (5) indicateurs droite `group-hover:hidden` : Paperclip 3×3 si pj, badge SLA si applicable, date `text-[11px] tabular-nums text-[color:var(--mail-text-muted)] w-12 text-right` au format `d MMM`.
- **Variables CSS thème-aware (Task #314)** définies dans `artifacts/ncv-mail/src/index.css` — `--mail-text-read` / `--mail-text-muted` / `--mail-text-faint` / `--mail-text-meta` / `--mail-text-meta-hover` / `--mail-border` / `--mail-border-hover` / `--mail-summary-text`. En **dark** elles reproduisent EXACTEMENT les hex historiques (#7a8290, #8b95a7, #5a6270, #6b7280, #b8c5d6, `border-border/40`) → rendu sombre strictement inchangé. En **clair** (palette Outlook-like AA) le texte des mails lus passe en `#1f2937` (quasi-noir, on garde juste `font-normal` au lieu de `font-semibold` pour distinguer), extraits/date en `#5f6368`, séparateurs en `#d2d0ce` (hover `#b8b6b3`).
- Au survol : composant partagé `<HoverActions>` (`@/components/email-list/HoverActions`) — parité 1:1 avec le clic droit (Reply / Forward / Snooze / Archive / Delete / Catégorie / Move to folder / Block sender). Prop `showBlockSender={false}` côté Envoyés.
- Clic droit : menu contextuel `min-w-[220px] max-w-[280px]` avec auto-flip (`useLayoutEffect`, bornes margin 8px, `maxHeight: calc(100vh - 16px)`, `overflow-y-auto`, `opacity 0` jusqu'à mesure).
- Référence d'implémentation : `artifacts/ncv-mail/src/pages/dashboard/index.tsx` (EmailRow L105+) et `artifacts/ncv-mail/src/pages/dashboard/envoyes.tsx` (L547+). À recopier tel quel pour Programmés / Reportés / Tâches / Archives / Mes dossiers / Partagées / Assignés.

## Header sticky mail (composant partagé)

Le bandeau sticky des pages mail (recherche + Actualiser + Nouvel email, onglets boîtes/équipe, ligne Filtres+pastilles+Catégories) existe en deux implémentations :
- **Réception (`pages/dashboard/index.tsx`)** : implémentation **inline historique** — référence visuelle/fonctionnelle source-of-truth, branchée à toutes les queries de la page (filtres, recherche, mode personal/shared, etc.). **À NE PAS modifier sans demande explicite** (cf. instruction utilisateur Task #300).
- **Envoyés / Programmés / Mes dossiers (vue racine)** : composant partagé `artifacts/ncv-mail/src/components/email-list/MailPageHeader.tsx` qui **reproduit visuellement** le bandeau de Réception. La recherche, les filtres et les pastilles ont un état **local** (non branché aux datasets de ces pages — wire-up futur via la prop `onSearchChange`). Les onglets et l'action « Partagées » naviguent vers `/dashboard?mode=shared` ; `index.tsx` lit ce paramètre et active le mode shared.

Convention : toute nouvelle page de liste mails (Programmés / Reportés / Tâches / Archives / Partagées / Mes dossiers / Assignés …) doit monter `<MailPageHeader currentTab="..." />` immédiatement après `<DashboardLayout>` (avant le `<div className="max-w-6xl ...">`). N'ajouter le header que sur la **vue racine** d'une page (jamais sur une vue détail/sous-dossier).

## Gotchas

- **Doublons catégories (race condition triage)**: appliquer manuellement `artifacts/api-server/migrations/2026_05_28_categories_unique_per_user.sql` dans Supabase. Symptôme : panneau « Nettoyer les doublons » affichait 3081 paires identiques « Newsletters/Newsletters » pour 1 user, parce que auto-sync.ts (L661-688) et webhook.ts (L157-181) faisaient SELECT-then-INSERT sans contrainte unique → 100+ INSERT parallèles au triage IA passaient tous → 79 copies de la même catégorie en DB → C(79,2)=3081 paires. La migration (a) dédoublonne les catégories existantes en gardant celle qui a le plus d'emails (réaffectation puis DELETE), (b) crée un index UNIQUE partiel `categories_user_name_unique` sur `(user_id, lower(trim(name))) WHERE is_system=false`. Le code applicatif gère déjà le 23505 fallback. Côté UI : nouvelle structure `{ clusters, pairs }` retournée par `/api/categories/duplicates` (similarity.ts → `findDuplicateReport`) — 1 cluster = N homonymes fusionnés en 1 passe via `POST /api/categories/merge-cluster { targetId, sourceIds[] }`. Le panneau de nettoyage affiche une section « Doublons exacts » (clusters, fusion massive) au-dessus de « Noms similaires » (paires classiques inchangées).
- **Supabase Migrations**: Ensure `migrations/2026_05_03_email_chunks.sql` is applied manually in Supabase Dashboard for Inboria Email Brain to function. The worker will pause if the table is missing.
- **Notes RDV ciblées (Task #316)**: appliquer manuellement `artifacts/api-server/migrations/2026_05_24_appointment_notes_recipients.sql` dans Supabase (ajoute `appointment_internal_notes.recipient_user_ids uuid[]` + index gin). Sans ça, l'INSERT note interne échouera silencieusement quand on choisit des destinataires précis dans le picker (« Toute l'équipe » continuera de marcher car la colonne est nullable et fallback). Backend : flow unifié — POST /api/appointments avec `status: "pending"` + au moins un participant externe (non membre de l'orga) envoie automatiquement le mail de proposition via `sendProposalForExistingAppointment` (helper exporté de `meeting-proposals.ts`) qui réutilise generateProposalEmailBody + recordSentProposal + set proposal_message_id/proposal_recipient/proposal_lang/awaiting_reminder_at sur la ligne déjà insérée. POST accepte aussi `internalNote: { body, recipientUserIds? }` pour créer une note interne en même temps que le RDV. POST /api/appointments/:id/internal-notes accepte désormais `recipientUserIds[]` pour cibler la notif cloche ; écriture ouverte à tout membre de l'orga (la restriction owner-only était trop frustrante). Frontend : bloc « Co-organisateurs internes » supprimé du panneau détail agenda (feature backend gardée pour propagation notifs RDV) ; remplacé par picker destinataires dans le composer de notes + même picker dans le formulaire Nouveau RDV (quand un texte de note est saisi).
- **Sync calendrier externe (RDV Phase 2)**: `artifacts/api-server/migrations/2026_05_10_appointments_external_sync.sql` doit être appliquée manuellement dans Supabase (ajoute `appointments.organizer_email`, `external_provider`, `external_id`, `calendar_account_id`, `last_synced_at`…). Sans ça le SELECT template du flow contre-proposition multi-créneaux échoue avec "column appointments.organizer_email does not exist", l'INSERT counter_proposed est skippé et les 3 propositions du groupe restent annulées sans nouvelle ligne en agenda.
- **Multi-créneaux RDV (groupe)**: appliquer manuellement `artifacts/api-server/migrations/2026_05_14_appointment_proposal_group.sql` dans Supabase (ajoute la colonne `appointments.proposal_group_id` + index partiel). Sans ça, l'envoi de plusieurs créneaux dans un seul mail (`/api/appointments/propose-multi`) échouera à l'INSERT.
- **Lien visio personnel (Teams/Meet)**: appliquer manuellement `artifacts/api-server/migrations/2026_05_15_personal_video_url.sql` dans Supabase (ajoute `profiles.personal_video_url`). Sans ça, le bouton "Enregistrer" du lien visio en paramètres ne persistera rien (silent ignore côté backend).
- **Post-validation langue (Task #306 phase 6)**: appliquer manuellement `artifacts/api-server/migrations/2026_05_21_inboria_chat_logs_lang_drift.sql` dans Supabase (ajoute `inboria_chat_logs.language_drift_detected boolean default false` + index partiel). Sans ça, l'INSERT du log chat échouera silencieusement à chaque drift détecté. Le mécanisme : après génération de `reply`, on compare `detectLangCode(question)` vs `detectLangCode(reply)` ; si mismatch, 1 retry gpt-4o-mini avec consigne stricte de ré-écriture (`STRICT_LANG_RETRY_PROMPTS[expectedLang]`, 19 langues couvertes : fr/en/es/de/nl/it/pt/pl/ro/tr/ja/zh/ko/he/ar/ru/th/hi/km). Si retry réussit, on remplace silencieusement ; sinon on garde l'original + flag `language_drift_detected=true`. Coût marginal : 1 appel mini sur ~2-5% des requêtes uniquement.
- **LLM-judge + A/B shadow (Task #306 phase 5)**: appliquer manuellement `artifacts/api-server/migrations/2026_05_20_inboria_judge_ab.sql` dans Supabase (ajoute à `inboria_chat_logs` les colonnes `judge_score`, `judge_reason`, `judge_model`, `judge_latency_ms`, `judge_at`, `ab_variant`, `ab_shadow_model`, `ab_shadow_reply_len`, `ab_shadow_score`, `ab_shadow_latency_ms` + 2 index partiels). Sans ça, le judge async (gpt-4o-mini qui note 0-100 chaque réponse Inboria) et le A/B shadow run échoueront silencieusement à l'UPDATE et le dashboard admin `#inboria` affichera 0 partout sur les colonnes judge/AB. Env vars : `INBORIA_JUDGE_RATE` (0-1, défaut 1.0 = score 100% des requêtes, ~$0.0001/scoring), `INBORIA_AB_SHADOW_RATE` (0-1, défaut 0 = désactivé, à monter à 0.05 puis 0.1 pour mesurer l'écart qualité gpt-4o vs gpt-4o-mini sur Essai/Solo). Phase 4 : routing silencieux gpt-4o pour Pro/Business activé sans toggle UI (`organisation.plan ∈ ['pro','business']`). Dashboard interne : onglet « Chat Inboria » dans `/dashboard/admin#inboria` (volume, fallback rate, reformulations, latence p50/p95, score judge moyen par modèle, A/B mini vs gpt-4o, top raisons fallback, pires réponses récentes à reviewer).
- **Auto-enrichissement harness (Task #306 phase 3)**: appliquer manuellement `artifacts/api-server/migrations/2026_05_19_inboria_harness_candidates.sql` dans Supabase (crée `inboria_harness_candidates` + index uniques + RLS service-role only). Sans ça, le cron hebdomadaire `harness-cron` détectera l'absence de table (cache 60s côté `harness-enrichment.ts`) et restera no-op silencieux. Le cron tourne toutes les 7j (1ère exécution +5min après boot du serveur), scanne les 7 derniers jours d'`inboria_chat_logs` (fallback OU reformulation < 30s), normalise les questions (NFD + lowercase + ponctuation collapsée), upsert dans la table candidats avec `occurrences` incrémenté pour les doublons. Un admin peut ensuite reviewer les `pending` par `occurrences DESC` et les promouvoir manuellement dans `scripts/challenge-inboria.ts`. Le harness est passé de 100 à **1500 tests** (100 manuels curated + ~1400 générés par `scripts/harness-generators.ts` : multilingue 43 langues, anti-hallu, jailbreak/prompt injection, edge cases robustesse, features non-impl, dataset Richard, PII privée, sections sidebar).
- **Logging chat Inboria (Task #306 phase 1+2)**: appliquer manuellement `artifacts/api-server/migrations/2026_05_18_inboria_chat_logs.sql` dans Supabase (crée `inboria_chat_logs` + 4 index + RLS user-scoped). Sans ça, aucune visibilité prod sur les questions chat des abonnés (le service log no-op proprement, cache `hasChatLogsTable()` 60s côté backend). Ne stocke QUE la question tapée par l'utilisateur (pas de contenu de mail) + métadonnées : modèle, latence, fallback déclenché, citation [mail#ID], reformulation < 30s (signal implicite d'insatisfaction).
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