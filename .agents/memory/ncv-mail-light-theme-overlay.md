---
name: ncv-mail light theme overlay traps
description: Why hardcoded hex colors silently break in ncv-mail light mode, and what to use instead.
---

# ncv-mail light theme = a curated hex-remap allowlist, not a full theme

The dashboard "light" mode is NOT a real per-token theme. It is an overlay in
`artifacts/ncv-mail/src/index.css` scoped to
`html[data-ncv-page="inbox"][data-ncv-theme="light"]` that:
- remaps the CSS variables (`--background`, `--foreground`, `--muted-foreground`,
  `--border`, …) globally, AND
- hard-remaps a **curated allowlist** of specific hardcoded hex utility classes
  (e.g. `.text-[#b8c5d6]`, `.bg-[#0b0d10]`, …) to light-safe colors, most guarded
  by `:not(.fixed)`.

**The trap:** any NEW hardcoded dark hex utility class that is NOT in that allowlist
stays its dark value while the surface around it flips to light → invisible text.
Real incident: install-guide modal step text used `text-[#d6deeb]` (not in the
allowlist) → pale blue text on the light-remapped white `bg-background` modal =
unreadable; close button hard to spot.

**Why:** the overlay was built by enumerating the hexes that existed at the time,
not by tokenizing everything. New code adds hexes the overlay never learned about.

**How to apply:**
- For ANY new dashboard UI, use theme tokens (`text-foreground`,
  `text-muted-foreground`, `bg-background`, `border-border`) — they adapt in both
  themes for free. Do NOT introduce new hardcoded hex text/bg colors.
- `hover:text-white` is also not remapped → on light hover surfaces it can vanish.
  Use `hover:text-foreground` / `hover:text-primary` instead.
- There is now a consolidated "BALAYAGE LISIBILITÉ MODE CLAIR (sweep global)" block
  in `index.css` (just before the T004 collision-banner rules) that retro-remaps the
  pale hexes/backgrounds/`hover:text-white` that existed at sweep time. It does NOT
  make the overlay self-maintaining — any NEW hardcoded pale hex still goes invisible.
  Prefer tokens; only extend that block when you must keep a hardcoded hex.
- Authority for the `<html>` theme attributes is the **centralized router
  controller** (a `useLayoutEffect` in `App.tsx`'s `Router`, keyed on wouter
  `location`): `/dashboard*` => `data-ncv-page="inbox"` + stored theme; every
  other route => remove `data-ncv-page` + force `data-ncv-theme="dark"`. Light
  mode is therefore an app-only (logged-in) choice; vitrine/login/signup are
  ALWAYS dark. Do NOT write theme/page attributes to `<html>` from anywhere else.
- **Why central:** light used to bleed onto public pages after leaving the app —
  `useMarkInboxPage` restored a stale `data-ncv-page="inbox"` on unmount and
  `data-ncv-theme="light"` lingered across SPA nav (some light rules key on
  `data-ncv-theme="light"` alone, e.g. the chat button). The hook now only ever
  `removeAttribute("data-ncv-page")` on unmount; the router is the single source.
- `useLayoutEffect` (pre-paint) is essential here: a passive `useEffect` would let
  the public page paint light for one frame before correcting → visible flash.
- The overlay still reaches portaled content (AlertDialog/Dialog live under
  `<html>`), so within the dashboard light mode applies app-wide.
- Radix `AlertDialog` does NOT close on outside-click (only Escape + its buttons),
  so an unreadable cancel button feels like "can't close it".

## Semantic colors (green success / red danger) are pale → fixed by a global remap
Tailwind `text-emerald-300/400`, `text-green-*`, `text-red-300/400` (+ opacity
variants like `text-red-400/70`) are too pale on the light surfaces → low contrast
(e.g. "Traité par …" badge in emerald, "Supprimer" button in red). There is now a
GLOBAL block in `index.css` under `html[data-ncv-theme="light"]` (right after the
context-menu red rules) that darkens these to AA: greens → `#047857` (hover
`#065f46`), reds → `#dc2626` (hover `#b91c1c`), plus emerald/red badge bg/border
tweaks. Applies app-wide incl. portals; dark mode untouched. New pale green/red
utility classes outside this list still need adding here (or use tokens).

## Gotcha: shadcn `outline` variant is invisible in light mode
The `outline` Button variant (components/ui/button.tsx) has NO own text/bg color — it
inherits the surrounding text color and only sets a border via `--button-outline`. In
dark mode the inherited text is light → visible; in light mode text+border blend into
the light background → the button disappears.
**Fix pattern (theme-safe):** for an accent action button, set explicit `text-primary
border-primary/40 hover:bg-primary/10 hover:text-primary` instead of relying on `outline`.
`--primary` (brand blue) is intentionally identical in light & dark, so it stays visible
in both. Example already in code: the "C'est moi qui envoie" button next to the shared-draft toggle.
