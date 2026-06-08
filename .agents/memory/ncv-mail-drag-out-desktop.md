---
name: HTML5 drag-out to desktop (DownloadURL)
description: Why "drag a file/email out onto the desktop" silently fails and how to make it work.
---

# Drag-out to desktop (Chromium DownloadURL)

Used by ncv-mail for dragging an attachment (AttachmentList.tsx) or a whole
email .eml (EmailDetail.tsx ExportEmlButton) onto the OS desktop.

## The core trap
`dataTransfer` is **only writable synchronously inside the `dragstart` handler**.
Any `e.dataTransfer.setData("DownloadURL", …)` called later (e.g. inside a
`fetch().then()` / `await`) is **silently ignored** — the drag carries only the
placeholder, so nothing is saved. The original code fetched the blob async and
set the real URL afterwards → no-op → "I can't drag it out".

## The fix
Pre-fetch the file BEFORE the drag and keep its `URL.createObjectURL` blob URL
in a ref (Map keyed by id, revoked on unmount). Trigger the prefetch on
`onMouseEnter` + `onPointerDown` (both fire before `dragstart`). In `dragstart`,
if the blob URL is ready set `DownloadURL` = `${mime}:${filename}:${blobUrl}`
synchronously; if not ready, `preventDefault()` and prefetch for the next try.
Auth: the download endpoint needs a Bearer token, so a bare endpoint URL in
DownloadURL won't work — the blob URL sidesteps that.

## Dragging a whole email from a LIST row
Reusable hook `src/hooks/use-row-drag-out.ts` (fetches `.eml` via authFetch,
same prefetch-on-hover/pointerdown pattern). Wire its props onto the row's
AVATAR element, NOT the whole row — the list rows already use mousedown-drag for
rubber-band multi-select (`onDragSelectStart`), so a full-row HTML5 `draggable`
collides with it. The avatar handle gets `onMouseDown`/`onClick` stopPropagation
so it neither starts the lasso nor opens the mail; its `onDragStart` also
stopPropagations.

Most list pages render rows with an inline `.map`, so you **cannot** call the
hook per-row (hooks-in-loops). Use the shared wrapper
`src/components/email-list/DragOutAvatar.tsx` (calls the hook internally, renders
the standard `bg-primary/15` avatar circle) and just pass `emailId/subject/letter`.
Réception (`index.tsx`) keeps its own inline avatar; every other page uses
`DragOutAvatar`.

**Which pages can be drag-out'd:** only pages whose rows are REAL emails
(`emails` table id, generic `api/emails/:id/export.eml`): inbox, envoyes,
reportes, relances, archives, dossiers, corbeille, indesirables. **Exclude**
`programmes` (rows are *scheduled* emails — `getListScheduledEmails`, ids ≠
emails.id → 404) and `taches` (rows are tasks, not mails). Relances rows wrap the
mail in `f.emails`, gate on `hasEmail` before mounting the drag avatar.

**Shared blob cache:** the hook keeps a module-level LRU(60) `Map` of blob URLs
keyed by emailId + an in-flight `Set` to dedup concurrent fetches across
views/pages. Effect: once a mail's `.eml` is prefetched anywhere, the first drag
on any page is instant (mitigates the "first drag silently aborts" feel). True
LRU = `touch()` (delete+re-set) on every get/has; `rememberBlob` revokes the old
ObjectURL when a key is rewritten and evicts+revokes the oldest past the cap.

## Bundling trap: drag worked ONLY on Réception (route-chunk ownership)
**Symptom:** drag-out worked on Réception (`index.tsx`) but was a silent no-op on
every page using `DragOutAvatar` (envoyes/reportes/relances/archives/dossiers/
corbeille/indesirables).
**Why:** `index.tsx` (a lazy *route* chunk) imports `use-row-drag-out` inline, so
Rollup bundled the hook (with the `DownloadURL`/`rfc822` setData logic) INTO the
Réception route chunk. The shared `DragOutAvatar` chunk then statically imported
the hook FROM that route chunk → on other routes that chunk isn't loaded/init'd →
drag does nothing, no error. Réception worked only because it owns the code.
**How to apply:** a SHARED chunk must never depend on a ROUTE chunk. Fix is a
`build.rollupOptions.output.manualChunks` rule in `vite.config.ts` forcing
`use-row-drag-out` + `DragOutAvatar` into a dedicated `drag-out` chunk. Verify on
the PROD build (not dev — Vite dev is unbundled so the bug can't reproduce): the
`drag-out-*.js` chunk must contain `DownloadURL`/`rfc822` and have NO static
`from "./index-*"` route import. Only fixed in prod AFTER republish (the live
bundle keeps the old chunk graph until then).

## Environment gotcha (why "it doesn't work in DEV")
**Why:** drag-to-desktop is blocked from the Replit workspace preview because the
app runs in an embedded (sandboxed/cross-origin) iframe; the drag never reaches
the OS. It also only works in Chromium (Chrome/Edge), never Firefox/Safari.
**How to apply:** tell the user to test in a standalone Chrome tab (open the dev
URL directly) or on the deployed app — not the in-workspace preview. Always keep
click-to-download as the universal fallback.
