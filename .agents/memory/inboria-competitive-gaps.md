---
name: Inboria competitive gaps (Superhuman / Missive)
description: Product analysis — what Inboria already has vs the real missing features facing Superhuman (speed) and Missive (collaboration). Discuss before building any of these.
---

# Inboria vs Superhuman & Missive — audit (verified in code)

Context: the user wants Inboria to rival **Superhuman** (speed) and **Missive**
(collaboration). This is the "B" track — the user wants to **discuss each item
before any build**. Do NOT start implementing these without his go-ahead.

## Already exists (do NOT rebuild — verified in code)
- Superhuman side: keyboard shortcuts (`j`/`k`, `e` archive, `r` reply, `f`
  forward, `h` snooze, `#` delete, `?` help, `Esc`), scheduled send, undo send,
  templates, read receipts / tracking pixel, follow-ups, snooze.
- Missive side: shared mailboxes, assignment, internal comments, **@mentions**
  + notifications, real-time presence (who's looking / typing — **on comments
  only**), SLA, team dashboard, automation rules.
- Speed/perf: pages are `lazy()` code-split; react-query `staleTime` 30s–5min,
  `placeholderData(prev)` (no empty flash); mail detail prefetched on row hover;
  sidebar links prefetch their *data* on hover; (added) sidebar links also
  preload their *JS chunk* on hover, and `j`/`k` look-ahead prefetch mails.

## The 5 "B" features — NOW ALL SHIPPED (re-verify before claiming otherwise)
The five gaps below have since been built; treat them as DONE, not missing:
1. **Real command palette** — `components/command-palette.tsx`.
2. **Auto-advance** — `pages/dashboard/index.tsx` (`computeAutoAdvanceId`, ~L4851).
3. **Keyboard nav / multi-select** — shipped alongside the palette/shortcuts.
4. **Collision detection at reply time** — `hooks/use-email-presence.ts` (per-mail
   presence), wired into the reply composer.
5. **Shared drafts** — `hooks/use-shared-draft.ts` + `EmailDetail.tsx` (see
   replit.md `shared_drafts` gotcha; needs the migration applied).

**Where rivals still win (be honest, do NOT overclaim parity):** product maturity
& polish, scale/reliability at volume, breadth of native integrations (Front),
brand trust, and raw perceived speed (Superhuman's obsessive perf). Inboria's edge
is the *combination*: native AI triage/drafting + 43-language support + Superhuman-
style speed + Missive-style collaboration in one product.

**Why this matters:** the user got frustrated when work was proposed without first
checking what already existed. Always re-verify the live code before proposing or
claiming anything — several "missing" things turned out to already exist.
