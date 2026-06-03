---
name: ncv-mail homepage AnimatedDemo must mirror the real app
description: The marketing homepage mockup hard-copies the dashboard nav/tabs and silently drifts when the app changes.
---

# Keep the homepage AnimatedDemo in sync with the real dashboard

The homepage hero animation (`components/marketing/animated-demo.tsx`) renders a
**hand-coded static replica** of the dashboard: a sidebar nav list (`NAV_KEYS`)
and the Réception tab rows. It is NOT generated from the app — it is a separate
copy, so it drifts out of date whenever the real UI changes.

**Why it matters:** users notice the marketing demo no longer matching their app
("l'animation ne correspond plus à la réalité"). The two have already diverged once:
several sidebar items (Assignés, Reportés, Tâches, Relances, Boîtes partagées,
Mon équipe, Activité équipe, Dossiers équipe, Archives) were moved from the sidebar
into the Réception **tabs**, but the demo still listed them in the sidebar.

**How to apply:** whenever you change the dashboard sidebar (`dashboard-layout.tsx`
`baseNavigation`) or the inbox tab rows (`pages/dashboard/index.tsx`), also update
`animated-demo.tsx` to match. Source of truth for the demo:
- Sidebar = `baseNavigation` (+ Admin for internal admins).
- Tab row 1 = boxes (Réception/Indésirables/Corbeille/comptes); row 2 = team &
  productivity (Partagées/Assignés/Reportés/Tâches/Dossiers équipe/Relances/Archives).
Reuse existing i18n keys + lucide icons already used by the real components.
