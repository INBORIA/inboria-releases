---
name: ncv-mail lazy routes have no error boundary
description: Why a ncv-mail dashboard page can flash blank, and the real launch risk it hides
---

In `artifacts/ncv-mail/src/App.tsx` the routes are wrapped only in a `<Suspense fallback={RouteLoadingFallback}>` (a spinner) — there is **no React error boundary**. Each dashboard page is a `lazy(() => import(...))` chunk.

Consequence: if a lazy chunk's dynamic `import()` rejects (e.g. the chunk hash changed because a new build/deploy happened while a tab was already open, or a transient network/service-worker race), React unmounts the whole tree. The user sees a **blank dark page with only the toast/"Notifications" region** — no spinner (the spinner only covers loading, not load *errors*), and sometimes no captured `pageerror` in tooling.

**Why it matters:** observed twice as a flaky blank on `/dashboard/parametres/mon-compte` during testing — root cause was a rebuild firing mid-test (chunk hashes changed under the running browser), NOT a bug in the page. A clean run rendered the page perfectly. The same mechanism will hit **real users with an open tab whenever a new version is deployed** (their cached index references old chunk hashes). PWA service-worker precaching (see ncv-mail-pwa-stale-cache) amplifies this.

**How to apply:**
- A transient blank page on a ncv-mail lazy route, with no console/pageerror and that a *clean reload on a stable build* fixes, is almost always a chunk-hash race — do NOT chase it as a page bug. Re-test on a stable build before concluding.
- Before launch, consider adding an error boundary around the route Suspense that, on a chunk-load error, shows a friendly "new version available, reload" fallback (and ideally auto-reloads once). This is a real robustness gap, but it is a non-trivial change — get user sign-off first (user wants to approve major changes).
