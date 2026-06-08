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
3. 🟠 AI/workers run in-process (same Node as the API).
4. 🟠 ~3 realtime channels per opened mail.
5. 🟡 No global OpenAI throttle.
6. 🟡 Heavy DB queries (N+1, re-sorting ~1000 rows in memory).

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
