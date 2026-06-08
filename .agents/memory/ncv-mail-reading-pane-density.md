---
name: Reading pane position & mail density
description: How the reading-pane position (right/bottom/off) and row-density settings are wired, and the legacy on/off toggle gotcha.
---

# Reading pane position + mail density (Inboria / ncv-mail)

Two global display settings persisted in localStorage and broadcast via CustomEvent (same pattern as the mail-header-collapsed setting): row **density** (compact/normal/comfortable) and reading-pane **position** (right/bottom/off). UI for both = a shared ViewOptionsMenu dropdown.

## Gotcha — legacy on/off toggle must restore the last visible side
The boolean reading-pane toggle (used by many list pages) stays backed by the position store (enabled = position !== "off"). When hidden, the position key becomes "off", erasing the prior value. So the last **visible** side must be stored in a SEPARATE key and restored on re-enable; otherwise turning the pane off then on silently discards a "bottom" preference and always falls back to "right".

**Why:** a code reviewer caught exactly this regression.
**How to apply:** any new pane-position writer must keep the separate last-visible key in sync (non-off writes only); the boolean toggle reads from it.

## Coherence requirement (each setting must reach every mail list)
Density is read inside the per-row component AND must be passed as the virtualizer `estimateSize`, or virtualized rows overlap/clip. Each mail-list page keeps its own recopied row implementation, so neither density nor pane-position propagate automatically — every new mail-list page must opt in to both, and the ViewOptionsMenu is misleading anywhere it renders but isn't wired (a dead control). Propagation beyond Réception was a deliberate later iteration.
