---
name: Inboria scalability roadmap (target 5000 subscribers)
description: The 6 load-bearing points to scale Inboria's email autopilot to 5000 subscribers, tackled one-by-one interactively with the user; what's done and the hard invariants.
---

# Inboria — montée en charge vers 5000 abonnés

User goal: assumer 5000 abonnés "sans le moindre souci". Done one-by-one,
interactively (user wants feedback before each major step; no isolated task agents).

## The 6 load points (from a scalability audit)
1. 🔴 No distributed lock / dedup across server instances → double-processing the day we run >1 instance. (Only matters with multiple instances.) **DONE** — per-connection lease.
2. 🔴 Sequential mailbox sync (`for...of await`). **DONE** — parallelized.
3. 🟠 AI/workers run in-process (same Node as the API). **DONE** — splittable by APP_ROLE.
4. 🟠 ~3 realtime channels per opened mail. **DONE** — comments channel now gated by chatVisible.
5. 🟡 No global OpenAI throttle. **DONE** — shared client + global concurrency gate.
6. 🟡 Heavy DB queries (N+1, re-sorting ~1000 rows in memory). **DONE (safe slice)** — analytics N+1 batched + smart-sort tasks/PJ scoped to the returned page.

Order chosen: start with #2 (best risk/reward, helps even single-instance).

**Honest caveat given to user:** a *truly* rock-solid 5000 needs #1 + #2 + #3
together. #2 alone multiplies throughput but the auto-sync cycle is a fixed
interval (SYNC_INTERVAL_MS, 300s) so per-cycle throughput is still capped;
externalizing workers (#3) and multi-instance (#1) are required to fully get there.

## Point #2 — relève en parallèle (implemented)
`runSyncLoop` uses a bounded worker pool instead of a sequential loop.
**Why:** at thousands of connections, sequential IMAP/Graph fetches blow past
the sync interval.
**Hard invariants to preserve in any future change:**
- `perConnection` results MUST stay in input order (write by index, not push) —
  tests and logs assert this.
- Per-connection isolation via `safeRunForConnection` — one bad box never stops others.
- Concurrency via env `SYNC_CONCURRENCY` (default 8), clamped to [1..nb connexions].
- Anti-overlap of whole cycles already handled by `syncRunning` in `runAutoSync` —
  don't remove it; parallelism is *within* a cycle only.
- Parallel sync also parallelizes the AI triage it triggers → keep concurrency
  modest until point #5 (global OpenAI throttle) lands.

## Point #4 — canaux Realtime par mail (implemented)
Per opened mail (shared context) up to 4 Supabase channels: `email-thread-<id>`
(comments presence/typing/broadcast, email-comments.tsx), `email-reply-<id>`
(collision presence, use-email-presence.ts — already gated `enabled:isSharedContext`),
`draft-<id>` + `yjs:draft-<id>` (shared-draft + Yjs CRDT, only while composing).
Fix: the `email-thread-<id>` effect was the ONLY one not gated — it subscribed for
EVERY opened mail, even a solo user's personal mail (where the team chat is never
shown). Now it early-returns (setPresence([]) ) unless `chatVisible` (isShared ||
isCollabAssignment), with `chatVisible` in the effect deps so it closes/reopens on flip.
**Why:** most of 5000 users open personal mail → was 1 wasted presence channel each +
fed the gotrue auth-lock thrash. Pure perf change, ZERO behavior change (the comments
module already `return null` when !chatVisible — pre-existing, unrelated to this edit).
**Not done (optional, riskier, needs 2-account e2e):** merging the two shared-context
presence channels (`email-thread` + `email-reply`) into one `email-collaboration-<id>`,
and sharing `draft-<id>` with the Yjs provider. Touches live team-collab code (delicate
CRDT anti-echo) — left as a future opt-in, not worth the regression risk now.

## Point #5 — throttle OpenAI global (implemented)
Single shared OpenAI client lives in `services/ai-client.ts` (export `openai`). Before,
~18 separate `new OpenAI(...)` (workers + HTTP routes), same key, zero coordination →
pics could fire dozens of concurrent OpenAI calls (429 cascades + cost). Now `chat.
completions.create` and `embeddings.create` are wrapped by a process-global semaphore
(`OPENAI_MAX_CONCURRENCY`, default 8; `OPENAI_MAX_RETRIES`, default 4 = SDK backoff on
429/5xx + Retry-After). All 18 sites import the shared `openai`; the ~50 `openai.x.create
({...})` call lines are unchanged. `import OpenAI` kept everywhere (still a type in some
files; `noUnusedLocals:false` so harmless when unused).
**Hard invariant — the semaphore MUST be reservation-safe (transfer-of-permit):** on
release, if a caller is queued, hand it the permit directly WITHOUT decrementing `active`;
only decrement when the queue is empty. The naive "decrement then wake a waiter" is BUGGY
— a fresh caller steals the freed slot before the woken waiter resumes, and the waiter
then increments anyway → cap exceeded (MAX=1 → 2 in flight) + FIFO violation. Architect
caught exactly this in the first pass; fixed via `acquire()`/`release()`. Verified with a
throwaway 100-task test: maxObserved == MAX, queue drains to 0, queued tasks start FIFO.
**Notes:** streaming releases the permit when `create()` resolves (stream handle obtained),
not at stream end — acceptable today (no `stream:true` in api-server/src); revisit if
streaming is adopted broadly. `openai.models.list()` (admin health-check) stays outside
the gate on purpose (rare, admin-only). `aiLimiterStats()` exported for a future admin
endpoint. Tunables ship generous so nothing slows down today — the cap only bites in pics.

## Point #6 — requêtes DB lourdes (implemented, scope volontairement étroit)
Deliberately shipped only the strictly behavior-preserving wins; left the bigger
risky refactors as documented future work (see below).
**(A) analytics.ts N+1 profils → 1 batch.** 3 boucles identiques (`/analytics/team`,
export CSV, export PDF) faisaient un SELECT `profiles` PAR membre d'orga → remplacées
par un unique `.in('id', memberIds)`. Équivalence vérifiée : tous les usages aval sont
`profileMap.get(uid) || ""` ou `|| uid.slice(0,8)`, donc membre sans ligne profil →
clé absente → `undefined` → même fallback qu'avant (`""`). Architect PASS.
**(B) emails.ts GET /emails — compteurs tasks/PJ après le slice.** Le tri intelligent
(`sort=smart`) est OPT-IN (toggle frontend `inbox.smartSort`, défaut OFF) → le chemin
boîte de réception PAR DÉFAUT fait déjà `.range(from,to)` (une seule page), il est déjà
efficace. En smart on chargeait tasks + email_attachments via deux `.in()` sur les ~1000
ids candidats AVANT tri/slice ; déplacé APRÈS sort+slice → ne porte plus que sur les
≤limit ids de la page renvoyée. **Invariant : tasks/PJ ne participent JAMAIS au tri**
(seuls inboriaScore via `inboria_signals` + created_at trient) → déplacement sûr. Le
fetch `inboria_signals` reste sur TOUT l'ensemble candidat (nécessaire au score global).
En tri classique `mapped` == la page → `pageEmailIds` == ancien `emailIds`, comportement
strictement identique. Objets `mapped` initialisés `taskCount:0/attachmentCount:0` puis
patchés in-place. Architect PASS.
**Laissé de côté (gros refactor risqué, PAS fait — à rouvrir si besoin) :**
- emails.ts smart : on fetch encore jusqu'à 1000 lignes FULL (+ joins categories/projects)
  alors qu'on n'en renvoie que `limit`. Le vrai gain = fetch LÉGER (id, created_at) des
  1000 candidats + signals, trier/slicer, PUIS fetch FULL+joins uniquement sur les ids de
  page (réordonner en JS car `.in()` ne garde pas l'ordre). Bloquant : il faut appliquer
  TOUS les filtres (priority/category/status/snoozed/projectId/q-opérateurs/crmFilter) à
  l'identique sur 2 requêtes → factoriser l'application des filtres dans un helper unique
  (gros diff sur endpoint flagship). Opt-in + borné à 1000 → priorité basse pour l'instant.
- analytics.ts `fetchAllRows` (hardCap 50000 lignes, stats calculées en JS) = pattern
  "DB en JS", risque OOM à grande échelle. Vrai fix = agrégation SQL (RPC), mais les
  gotchas du projet déconseillent d'ajouter des fonctions SQL → laissé tel quel (analytics
  = basse fréquence, pas par requête).
- contacts.ts `/contacts/search` (5000 lignes agrégées en JS) et `/contacts/:email/timeline`
  (6+ requêtes parallèles) : déclenchés à l'action utilisateur (recherche debounced / clic),
  fréquence modérée → laissés.
- folders.ts GET /folders compte les assignations en JS (1 requête, N lignes) ; alternative
  = N+1 count par dossier ou RPC → l'existant est le moindre mal sans nouveau SQL.
