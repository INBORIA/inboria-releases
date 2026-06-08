---
name: Inboria distributed sync lock (scale point n°1)
description: How the multi-instance auto-sync lease works and the invariants that keep it from double-processing mail; read before touching runAutoSync's claim loop.
---

# Distributed sync lock (point n°1)

Lets several server instances share the mailbox sync without processing the same
mail twice. Lease-per-connection on `email_connections` (`sync_locked_by` +
`sync_locked_until`), claimed atomically via a Postgres RPC using
`FOR UPDATE SKIP LOCKED` (migration `2026_06_08_sync_claims.sql`,
applied manually in Supabase like every other migration).

**Why a lease, not a global cycle lock:** a single global lock would let only one
instance ever sync (others idle) — no load sharing. Per-connection leasing both
dedups AND distributes work (each instance claims different rows).

## Invariants — do not break these

- **The lease MUST be renewed while a batch is processing (heartbeat).** A heavy
  box (big first sync, thousands of mails) can take longer than the TTL; without
  renewal another instance re-claims it mid-flight → double execution. Renewal
  runs at ~1/3 TTL via a `setInterval` cleared in `finally`.
- **Distinguish "migration absent" from "transient RPC error".** Only a
  function/column-missing error (PGRST202 / 42883 / 42703 / "schema cache") may
  flip the process to permanent single-server fallback. A network blip must NOT
  disable distributed mode (it would silently re-introduce overlap in a cluster) —
  on transient error, skip the batch this cycle and keep distributed mode.
- **Graceful degradation:** with no migration applied, claim returns null and the
  code falls back to the old `select("*")` single-server path. Safe for a
  one-instance deploy; gives ZERO visible change until you actually run >1 instance.
- **`overrides.connections` path bypasses claim/release entirely** (tests, targeted
  sync). The integration test asserts the RPC is hit exactly once (the failure
  RPC), so the override path must never call claim/release/renew.
- **The in-process `syncRunning` guard stays** — it prevents overlapping cycles
  within ONE instance; the lease handles ACROSS instances. Both are needed.
- Tunables: `SYNC_CLAIM_BATCH` (default 250), `SYNC_LEASE_TTL_SECONDS` (default 600).

**Reality check given to the user:** n°1 changes nothing visible on a single
server — it's groundwork. The benefit appears the day a 2nd instance runs, which
5000 subscribers will require (rough sizing: ~3-5 sync/AI instances, but the real
ceilings are Supabase plan/pooling and OpenAI rate-limit/cost, which more app
servers do NOT fix). Exact count must be measured under load, not guessed.
