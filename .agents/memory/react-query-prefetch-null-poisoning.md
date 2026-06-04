---
name: React Query prefetch null-poisoning
description: A hover/prefetch query sharing a cache key with a main query must never cache null/fallback on failure, or it silently blanks the detail for the staleTime window.
---

When a hover-prefetch query and a main detail query share the SAME React Query
cache key (e.g. `["email-detail", id]`), they share one cache entry. If the
prefetch returns a fallback value (like `null`) on a transient failure while the
main query has a non-trivial `staleTime` (e.g. 30s), the cached fallback is served
to the main query for the whole staleTime window WITHOUT a refetch — silently
blanking the detail object.

**Why:** Symptom seen on ncv-mail: the « Brouillon partagé » button (gated on
`isSharedContext = email.sharedMailboxId || email.assignedTo`) vanished on shared
emails. The reading-pane email object is `{ ...listItem, ...emailDetailData }`.
On transient Supabase gotrue token-lock contention, the hover-prefetch failed,
returned `null`, cached it under the shared key; the main detail query then served
that `null` for 30s, so the merged email lost `sharedMailboxId` → button hidden.
The data path looked correct everywhere; the bug was purely cache poisoning.

**How to apply:**
- Prefetch and main queries that share a key must behave identically on failure:
  THROW (don't cache), so the cache keeps last-good data or stays empty and refetches.
- Set `retry: false` on the prefetch to avoid request noise.
- On prefetch failure, also drop the id from any "already prefetched" guard set
  (`.catch(() => prefetchedRef.current.delete(id))`) so a transient failure doesn't
  block re-prefetch for the rest of the session.
- Defense in depth: make the LIST payload carry the same gating fields (here
  `sharedMailboxId`/`assignedTo`) so the `{...listItem}` fallback still yields the
  right context on the very first open before detail resolves.
