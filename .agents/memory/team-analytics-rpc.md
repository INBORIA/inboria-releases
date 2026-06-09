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

## Parity gotcha — ties must be tie-broken on BOTH sides
The JS memory path is a **stable sort over PostgREST row order** (non-deterministic); the
SQL aggregate tie order is unspecified unless given a secondary key. Counts/totals were
always identical, but equal-count ordering diverged (and at a top-N cutoff can even change
*which* equal entries land in the top-10). Fix = a deterministic secondary key on **both**
engines:
- SQL: `order by <metric> desc, <text> collate "C"` (email/name) and `, <uuid col>` for the
  per-* lists / tasks_per_project (`mid`/`uid`/`pid`).
- JS: `cmp = (x,y) => Buffer.compare(Buffer.from(x,"utf8"), Buffer.from(y,"utf8"))` — UTF-8
  bytewise, which **exactly** mirrors `collate "C"` (incl. non-BMP/emoji). Do **not** use
  `<` (UTF-16 code units, diverges on supplementary chars). uuid/ASCII are identical either
  way.

Validated rpc-vs-memory byte-identical across 3 real orgs × 7d/30d/90d × member/mailbox/
project filters. perMember/tasksPerMember already match without an explicit text tie-break
because both engines consume the **same member-id array order** (SQL orders by the array
ordinal); leave them — forcing a cross-call order would change current output. NOTE: after
editing the SQL, the updated function must be re-applied in Supabase (no programmatic DDL —
see supabase-no-exec-sql.md) before a fresh run shows full byte-parity; the JS fix alone
clears it for any already-deterministic SQL columns.

**Why:** future edits to either path must keep the floor/clamp + `<43200` (30-day) response
bound, the modern (handled_by+handled_at) vs legacy (assigned/claimed proxy) split, openLoad
as an out-of-period snapshot, and tasksPerProject done=0 — both sides mirror these exactly.
