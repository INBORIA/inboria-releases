---
name: Team analytics DB-side aggregation (inboria_team_analytics)
description: GET /analytics/team can aggregate in Postgres via RPC instead of loading ~50k rows in Node; parity gotchas.
---

# `/analytics/team` DB-side aggregation

`GET /api/analytics/team` historically loaded up to ~50k email rows into Node and
aggregated in JS. There is now a Postgres function `inboria_team_analytics(...)` that does
the same aggregation server-side and returns one jsonb. The handler tries the RPC first and
**falls back to the unchanged in-memory path on any RPC error** (engine=auto). Hidden
diagnostic param `?engine=rpc|memory|auto` forces one path (rpc → 500 on failure, no
silent degrade; memory → skip RPC entirely). Name resolution (profiles/mailboxes/projects)
and SLA breach counts stay in Node after the RPC.

The SQL function lives in `artifacts/api-server/migrations/2026_06_09_team_analytics_rpc.sql`
and **must be applied manually in the Supabase SQL Editor** (this DB has no exec_sql — see
supabase-no-exec-sql.md). Until applied, engine=auto silently uses the memory path, so the
app keeps working.

## Parity gotcha — topSenders / topCategories ties
Validated rpc-vs-memory byte-identical across 3 real orgs × 7d/30d/90d × member/mailbox
filters EXCEPT the **top-10 cutoff ties**: the legacy memory path tie-breaks equal-count
senders by arbitrary DB return order (itself nondeterministic), the RPC tie-breaks
deterministically (`count desc, email`). Counts/distribution are identical; only *which*
equal-count entries land in the bottom of the top-10 can differ. This is acceptable (RPC is
strictly more deterministic). Don't chase a "0 diff" on tie membership — compare the count
distribution + the above-cutoff set instead.

**Why:** future edits to either path must keep the floor/clamp + `<43200` (30-day) response
bound, the modern (handled_by+handled_at) vs legacy (assigned/claimed proxy) split, openLoad
as an out-of-period snapshot, and tasksPerProject done=0 — both sides mirror these exactly.
