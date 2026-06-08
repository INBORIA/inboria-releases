---
name: Inboria worker/web role split (scale point n°3)
description: How the API process can run as web-only, worker-only, or both; the invariants for splitting AI/background work off the HTTP path. Read before changing index.ts boot or adding a new background worker.
---

# Web/worker role split (point n°3)

All ~15 background loops (auto-sync, AI triage, embeddings/inboria-extractor,
follow-up, SLA, webhooks, CRM sync, meeting/appointment/task workers, rule
digest, harness cron) historically started in the SAME Node process as the
Express HTTP server, in the `app.listen` callback of `artifacts/api-server/src/index.ts`.

Point n°3 makes that splittable via env `APP_ROLE`:
- `all` (default) → HTTP + every background worker (unchanged single-instance behaviour).
- `web` → HTTP only, NO background workers (autoscalable, never slowed by AI/sync).
- `worker` → background workers (still calls `app.listen` so Replit health checks pass).

## Invariants — do not break

- **Default MUST stay `all`** so a single-instance / dev deploy is byte-for-byte
  unchanged. This is groundwork; nothing visible changes until you actually run a
  separate worker deployment.
- **New background workers must be added INSIDE the `if (RUN_WORKERS)` block.**
  A worker started outside it would run on every web instance → duplicated work
  (and, for data-mutating maintenance like `cleanupDuplicateTasks`/`purgeNoiseTasks`,
  contention across all web instances).
- **Schema `ensure*` guards stay OUTSIDE the gate** (always run, any role): they
  are idempotent and the HTTP API needs the schema regardless of role.
- **`app.listen` always runs**, even in `worker` role — Replit needs a listening
  port for health checks; don't make worker mode headless.
- Pairs with point n°1 (distributed lock): once split, you can run MANY `worker`
  instances safely because the lease prevents double-processing the same mailbox.

**Why it matters / honest framing for the user:** within ONE current instance the
win is limited (most AI work is network I/O via OpenAI, not CPU that blocks the
event loop). The real benefit is *independent scaling* + isolating bursty
sync/AI load from user-facing HTTP latency, realized when web and worker run as
separate deployments. The code change here is the enabler; the actual split is a
deployment-config decision (set `APP_ROLE=web` on the web deployment,
`APP_ROLE=worker` on a dedicated worker deployment).
