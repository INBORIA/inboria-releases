---
name: This Supabase has no exec_sql RPC
description: Runtime code cannot run DDL/arbitrary SQL on this project's Supabase; migrations are pasted by the user.
---

# This project's Supabase exposes NO `exec_sql` RPC

Despite `artifacts/api-server/src/index.ts` calling `supabaseAdmin.rpc("exec_sql", { query })`
in several places, **the function does not exist in this DB**. Both fail:
- `rpc("exec_sql", { query })` → PGRST `Could not find the function public.exec_sql(query)`
- `POST {url}/rest/v1/rpc/exec_sql` → 404 PGRST202
- `POST {url}/sql` → 404 "requested path is invalid"

The `index.ts` calls are best-effort with REST fallbacks that silently no-op here; a
comment near the admin-team-access block already states "this project's Supabase does not
expose an exec_sql RPC".

**Why it matters:** you CANNOT create/alter tables or functions from the agent/runtime.
Any new SQL function or migration in `artifacts/api-server/migrations/` must be applied
**manually by the user** in the Supabase SQL Editor (the project's established pattern —
see the many "appliquer manuellement …" gotchas in replit.md).

**How to apply:** write the migration file (idempotent, `CREATE OR REPLACE` / `IF NOT
EXISTS`), then paste the full SQL into chat with simple steps and ask the user to run it.
Only after they confirm can you validate against the live DB. Do not assume you can
self-apply via `exec_sql`.
