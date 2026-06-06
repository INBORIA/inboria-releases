---
name: ncv-mail shared-draft real-time co-editing
description: How live "Google Docs"-style co-editing of shared drafts is wired (TipTap + Yjs over Supabase broadcast) and the non-obvious split of responsibilities.
---

# Co-édition temps réel des brouillons partagés (Inboria)

The reply editor has two modes:
- **Solo** = `SignatureEditor` (contentEditable + execCommand, HTML). Unchanged.
- **Shared draft active** = `CollaborativeComposer` (TipTap/ProseMirror + Yjs CRDT).

**Why TipTap pinned to v2:** v3 breaks the collaboration-cursor caret. Keep `@tiptap/*` on v2.x.

**Transport:** no dedicated WebSocket server. `SupabaseYjsProvider` rides a Supabase
broadcast channel (`yjs:draft-<id>`) for both doc deltas and awareness (cursors). A new
peer broadcasts `sync-request`; present peers reply with full `encodeStateAsUpdate` + awareness.
`StarterKit.configure({ history:false })` is mandatory with Collaboration (Yjs owns undo).

**Non-obvious split — who syncs what:**
- The `useSharedDraft` hook gets `bodyCollaborative: true`. In that mode it syncs ONLY
  to/cc/subject (broadcast + PATCH) and **excludes `body`**.
- The body is owned by Yjs; `CollaborativeComposer` persists it via its OWN debounced
  PATCH `api/drafts/:id {body}` so the draft survives reload/everyone-leaving.
- **How to apply:** any new field added to the draft sync must respect this split — body
  changes must never flow through the hook's broadcast/PATCH, or you double-write and fight Yjs.

**Anti-echo invariant:** the hook's `lastSyncedRef` must store the SAME JSON shape on emit
(`sync`) and on receive (`patch` handler). With `bodyCollaborative` that shape is
`{to,cc,subject}` (no body) on both sides — otherwise remote patches trigger parasitic
re-broadcast/re-PATCH.

**Seeding:** only one editor seeds initial HTML into the empty Yjs doc, gated by `canSeed`
(creator, or sole editor). `collabInitialBodyRef` in EmailDetail MUST be reset on email change,
else draft B can be re-seeded with draft A's body (content cross-contamination).

**Remote-selection color MUST be hex, not hsl:** y-prosemirror builds the remote-selection
decoration as `background-color: ${user.color}70` (appends an 8-digit-hex alpha). An `hsl(...)`
color produces invalid CSS (`hsl(...)70`) so distant selections silently DON'T render (carets
still work — they use the color verbatim). `colorForUser` therefore returns `#rrggbb`.
**Why:** caret worked but selection highlight was invisible; root cause was the color format.

**Safe deletion of a shared draft on send (resolved):** never `remove()` on click. The send
contract (`onSendReply`/`handleSendReply`) takes an optional `onSent` callback fired only in the
send mutation's `onSuccess` (i.e. after the ~10s undo window AND server confirmation). On undo
or error the draft is preserved. Two non-obvious requirements:
- For a SHARED draft do NOT clear/close the composer on click — the to/subject sync effect would
  push EMPTY values to peers and leave an amputated draft on undo/error. Clear only inside `onSent`.
  (Solo path still resets immediately — no draft to corrupt.)
- Capture the draft id at click and delete via `removeById(id)` (state-independent), NOT `remove()`
  which reads mutable hook state — if the composer is closed/deactivated during the undo window,
  `draftId` becomes null and the backend DELETE + peer `sent` broadcast are lost (stale draft +
  duplicate-send risk). `removeById` always DELETEs the captured id; peer broadcast is best-effort.

CSS for live cursors: `.collaboration-cursor__caret` / `__label` in `src/index.css`; the
TipTap editor carries class `signature-editor collab-editor` so it inherits list styles.
