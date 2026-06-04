---
name: optimistic-email cache-head coupling
description: Why the shared optimistic-email helpers silently do nothing on some mail pages, and how to extend them.
---

The shared optimistic-UI helpers for the mail lists (`removeEmailOptimistic`,
`removeEmailsOptimistic`, `patchEmailOptimistic`) patch React Query caches by
matching the **query-key head** (the endpoint URL orval puts at `queryKey[0]`)
against a predicate. They only mutate caches whose head the predicate accepts,
and they no-op on any cache whose data shape lacks `{ emails: [] }`.

**Why this bites:** different mail pages fetch from different endpoints, so each
has a different query-key head:
- standard views (Réception/Envoyés/Reportés/Archives) → `/api/emails(…)`
- "Mes dossiers" → `/api/folders/:id/emails(…)`
- shared mailboxes → their own head

If a page's list head is not in the predicate, calling the helper is a **silent
no-op for the visible list** — the row does not update optimistically AND the
rollback cannot restore it (nothing was patched). It looks wired-up and
typechecks, but does nothing. "Mes dossiers" snooze/archive shipped "optimistic"
for a long time while actually only running the `onSuccess` invalidate.

**How to apply:** before adding optimistic UI to any mail page, confirm the
page's list query-key head is accepted by the predicate. If not, broaden the
predicate (preferred — centralized, the helper is explicitly meant for all mail
pages) rather than hand-rolling per-page cache surgery. The patch functions
already guard on shape, so adding more heads is safe.
