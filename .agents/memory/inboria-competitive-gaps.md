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

## The 5 real missing features (the "B" list)
1. **Real Cmd+K command palette** — today Cmd+K only focuses the search input.
   A true palette (run any action / jump anywhere) is missing.
2. **Auto-advance** — after archive/snooze, automatically open the next mail.
3. **Go-to sequences** (keyboard) + **multi-select** via keyboard.
4. **Collision detection at reply time** — presence exists on comments, but the
   reply composer does NOT warn that a teammate is already replying to the same
   client. This is the Missive-style "someone else is answering" guard.
5. **Shared drafts** — co-writing / handing off a draft between teammates.

**Why this matters:** the user got frustrated when work was proposed without
first checking what already existed. Always re-verify the live code before
proposing any of these — several "missing" things turned out to already exist.
