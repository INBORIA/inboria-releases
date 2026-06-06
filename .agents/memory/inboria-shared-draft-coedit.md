---
name: Inboria shared-draft co-editing is real CRDT
description: The shared-draft email BODY is already true Google-Docs-style CRDT (Yjs+TipTap), not last-writer-wins; and the seeding-race trap.
---

# Shared drafts: the body is already true CRDT (Yjs), not last-writer-wins

**Reality (trust this over the older `replit.md` shared_drafts gotcha):** the email
**body** of a shared draft is co-edited with a real conflict-free CRDT — TipTap
(ProseMirror) + Yjs, transported over a Supabase broadcast channel via a custom
provider. Concurrent typing in the body merges without overwrite, like Google Docs.
Only the **metadata fields** (to / cc / subject) use the simpler last-writer-wins
broadcast. The `replit.md` "v1 dernier qui écrit gagne (pas d'OT/CRDT)" line and any
memory calling shared drafts a "missing feature" are STALE — the CRDT path was added
later and is wired (`bodyCollaborative: true`, `CollaborativeComposer` rendered when
the shared draft is active).

**Why this matters:** do not "build Google-Docs co-editing" from scratch — it exists.
Verify the live code before promising or rebuilding. I once told the user it was
last-writer-wins by trusting the stale note; it was wrong.

# Seeding race (the real robustness trap)

A fresh `Y.Doc` per client must be seeded from the persisted HTML exactly **once**,
by exactly **one** client, or you get DUPLICATED content (not "overwrite") when two
clients each seed their own doc and the CRDTs merge.

**Rule:** only seed when you are sure you should:
- the draft **creator** may always seed an empty doc, OR
- a client may seed only once presence is **confirmed** (`presenceSynced`) AND it is
  truly **alone** (`editors.length === 0`). Never seed on `editors.length === 0`
  before the first presence event — that fires for a joiner before it learns the
  creator/peers exist.

**How to apply:** the seed gate (`canSeed`) lives in `EmailDetail`; the per-doc seed
guard lives in `CollaborativeComposer`. Critical: set the "already seeded" guard ONLY
after a real seed happened OR the fragment is confirmed non-empty — never before the
gate check, or a joiner whose first attempt is gated-out gets permanently stuck with
an empty editor (deadlock). Let the seed effect re-run when `canSeed` flips
false→true. A small settle delay (~700ms) before seeding lets presence + Yjs sync
settle so two simultaneous opens don't both seed.
