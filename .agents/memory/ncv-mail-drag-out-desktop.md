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

## Environment gotcha (why "it doesn't work in DEV")
**Why:** drag-to-desktop is blocked from the Replit workspace preview because the
app runs in an embedded (sandboxed/cross-origin) iframe; the drag never reaches
the OS. It also only works in Chromium (Chrome/Edge), never Firefox/Safari.
**How to apply:** tell the user to test in a standalone Chrome tab (open the dev
URL directly) or on the deployed app — not the in-workspace preview. Always keep
click-to-download as the universal fallback.
