---
name: ncv-mail PWA stale-cache trap
description: Why UI changes to ncv-mail often "don't appear" even after a correct edit + workflow restart.
---

The `artifacts/ncv-mail: web` workflow runs `vite build && vite preview` (a PRODUCTION build served by preview), and the app ships a **PWA service worker** (vite-plugin-pwa, `generateSW`, ~100 precached entries, `registerType: autoUpdate` + `skipWaiting` + `clientsClaim`).

**Consequence:** a code edit does NOT hot-reload. It needs a workflow restart (to rebuild), and then the user's browser still serves the **precached old bundle**. With autoUpdate the new SW installs in the background but typically only takes effect on the **second reload** (or after closing all app tabs / unregistering the SW).

**Why this matters:** repeated user reports of "rien n'a changé / it didn't change" after a confirmed-correct edit + restart are almost always **stale SW cache**, not a code bug. Burned a long multi-turn loop chasing a phantom "barre à gauche" on the mail-list pages when the code was already correct.

**How to apply:**
- After editing ncv-mail UI, restart the workflow (rebuild), then tell the user to reload **twice** / hard-refresh / close-reopen the tab if it looks unchanged.
- Canvas iframe shapes tagged `artifact:v3:...` (no URL) are **frozen snapshots** — they never live-update; don't treat them as the running app.
- The headless `screenshot`/preview tool hits the app unauthenticated → returns the login page, so it can't verify authenticated dashboard pages. Don't rely on it to confirm logged-in UI.
- Don't "fix" the PWA config to solve this — it's already optimal (autoUpdate/skipWaiting/clientsClaim). The lag is inherent to service-worker precaching.
