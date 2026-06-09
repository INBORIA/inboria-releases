---
name: Inboria mobile app (Expo)
description: How the artifacts/inboria-mobile Expo app connects to the existing api-server backend and its dark-only theming.
---

# Inboria mobile (Expo) — backend wiring & theming

The Expo app `artifacts/inboria-mobile` is a thin native client on the EXISTING
`artifacts/api-server` (Express + external Supabase). It does NOT have its own
backend/DB.

## Networking — absolute URL, not relative
Mobile runs OUTSIDE the shared reverse proxy, so relative `/api/...` paths do
NOT resolve like they do on the web app. API calls MUST be absolute:
`https://${EXPO_PUBLIC_DOMAIN}/api/...`. `EXPO_PUBLIC_DOMAIN` is injected by the
dev workflow (`=$REPLIT_DEV_DOMAIN`) and at build time in prod; the shared proxy
then routes `/api` to api-server on the same domain. `lib/api.ts` mirrors the
web `authFetch` (Supabase session → `Authorization: Bearer`) and throws a loud
error if `EXPO_PUBLIC_DOMAIN` is missing rather than firing a malformed request.

**Why:** web uses `import.meta.env.BASE_URL` (relative, proxy-local); copying
that pattern to native silently 404s.

## Auth
Supabase email/password via `@supabase/supabase-js` + AsyncStorage
(`detectSessionInUrl:false`, AppState-driven autoRefresh on native). Env vars:
`EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` (both already set).
Route gating lives in `app/_layout.tsx` (segments-based redirect to `/login`).
No MFA UI in MVP (api-server validates the JWT per request).

## Theming — dark only
`hooks/useColors()` ALWAYS returns the dark palette (Inboria is dark-only by
brand). `constants/colors.ts` duplicates the palette under both `light` and
`dark` keys. Do NOT reintroduce the scaffold's `useColorScheme` cast — it breaks
typecheck once a `dark` key exists alongside the numeric `radius`.

## MVP scope (built)
login → inbox (`GET /api/emails?sort=recent|smart`, AI summary +
priority bar) → detail (`GET /api/emails/:id`, HTML stripped via `lib/html.ts`,
auto `PATCH status:read`) → reply (`POST /api/emails/send`, connectionId omitted
so the server picks the default connection). Enrichment (AI draft, attachments
view, folders, sent/scheduled, MFA) intentionally deferred.

## Email priority filter values (gotcha)
The backend stores/filters `emails.priority` as ONLY `urgent | moyen | faible`
(NOT urgente/haute/normale/basse). `/api/emails?priority=` does `.eq("priority",…)`,
so any other label silently returns an empty list. The mobile UI maps
Urgents→`urgent`, Importants→`moyen`. The inbox row priority bar keys on the same
3 values. Same trap for the web filter (`urgent | moyen | faible`).

## Web-fidelity (look = Inboria web)
Palette in `constants/colors.ts` is converted 1:1 from the web `index.css` HSL
tokens (primary `210 65% 50%` ≈ `#2D80D2`, bg `220 40% 7%`, card `225 25% 12%`)
plus the `--mail-*` vars (mailRead/mailMuted/mailBorder/mailSummary…). Real logo
(`assets/images/inboria-logo.png`, copied from attached_assets transparent fix v1)
on login + inbox header; app icon = `inboria_icon_512`. Inbox header mirrors web:
search (debounced 350ms → `q`), sort tabs (Récents default = `recent`, Tri IA =
`smart`), filter chips for priority + categories (`GET /api/categories`, only
chips with emailCount>0; sends `categoryId`). priority+category mutually exclusive.

EmailRow MUST be the web/mockup FLAT row, NOT an invented multi-line card. Ref =
canvas mockup `mockup-sandbox/.../inbox-redesign/SuperhumanDark.tsx` + real web
`ncv-mail/.../dashboard/index.tsx` L291 (h-[52px] flat row, avatar = first letter
L342). Mobile adaptation (2 lines for width): unread DOT (primary) on the left,
avatar 28, line1 = sender + time(right), line2 = subject(bold if unread) + "— extrait"
(summary, muted) INLINE + paperclip + lowercase category. NO left priority bar, NO
separate 3rd summary line — that 3-line card was the "tu as inventé une app" mistake.
The real web inbox has NO Important/Autres section grouping (mockup only) — it's a
filter dropdown (filterImportance all|important), already covered by the Urgents/
Importants chips; do NOT add sections or you re-invent.

**Why:** user was furious ("je ne vois que de la merde, tu as inventé une app au lieu
de copier Inboria"). Always match the real web/mockup row exactly; never invent layout.

**Blind-screenshot trap:** app_preview/headless browser is NEVER authenticated (401)
→ it only ever shows the LOGIN screen, never the inbox the user sees on the canvas.
Don't claim the inbox "works" from a login screenshot. To verify the authed look,
read the web/mockup source, or render the row in mockup-sandbox, or ask the user.

## Full sidebar parity (15 screens)
`AppMenu.tsx` reproduces the web sidebar 1:1 (same order/Feather icons):
Réception(/), Envoyés(/sent), Programmés(/scheduled), Reportés(/reportes),
Relances(/relances), Archives(/archive), Mes tâches(/taches), Contacts(/contacts),
Agenda(/agenda), Mes dossiers(/folders), Bilan quotidien(/bilan),
Catégories(/classement), Templates(/templates), Règles auto(/regles), Admin(/admin).
Every new screen MUST be registered as a `<Stack.Screen>` in `app/_layout.tsx` or
expo-router silently 404s the route.

## Read-only secondary screens pattern
reportes/relances/taches/agenda/bilan/classement/templates/regles/admin are
list/scroll views over existing backend routes (followups, tasks, appointments,
templates, automation-rules, categories, dashboard/summary, team/dashboard),
built with ScreenHeader + StateViews (SkeletonList/CenterState/FullLoader) +
FlatList/RefreshControl (ScrollView for sectioned Admin/Bilan). Only `taches` has
a write path (PATCH /:id done toggle). API list helpers live in `lib/api.ts`
after getProfile; FR date formatting in `lib/format.ts` (manual month names).

## showRecipient must reach EmailRow (gotcha)
`EmailListScreen` accepts `showRecipient` but you MUST forward it to `<EmailRow>`
in renderItem AND set it on `app/sent.tsx` — otherwise Envoyés shows the sender
instead of the recipient. Easy to add the prop to the wrapper and forget the
inner pass-through.
