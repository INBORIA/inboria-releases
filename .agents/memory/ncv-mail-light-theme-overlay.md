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
- The hook `useMarkInboxPage`/`useEnableLightTheme` (in `lib/inbox-theme.ts`) is
  called by EVERY dashboard page, so `data-ncv-page="inbox"` + light mode applies
  app-wide on the dashboard, including portaled content (AlertDialog/Dialog live
  under `<html>` so the overlay reaches them).
- Radix `AlertDialog` does NOT close on outside-click (only Escape + its buttons),
  so an unreadable cancel button feels like "can't close it".
