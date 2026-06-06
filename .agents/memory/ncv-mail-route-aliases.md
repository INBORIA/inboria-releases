---
name: ncv-mail dashboard route aliases
description: Sidebar labels that route to a different file than their name suggests (avoid editing the wrong page)
---

# ncv-mail dashboard route aliases

Some sidebar menu items route to a file whose name does NOT match the label. Editing the
obviously-named file then has no visible effect because that route is redirected/dead.

- **« Catégories » sidebar item** → `/dashboard/classement` → `pages/dashboard/classement.tsx`.
  `/dashboard/categories` is a **Redirect to /dashboard/classement**, and
  `pages/dashboard/categories.tsx` is no longer rendered by any live route (effectively dead).
  **Why:** a UI change to the Categories page must go in `classement.tsx`, not `categories.tsx`.
  **How to apply:** before editing a page, confirm the sidebar `href` in
  `components/layout/dashboard-layout.tsx` and the `<Route>` in `App.tsx` — do not trust the filename.

## Unified header search behavior
`MailPageHeader` search (Enter) navigates to `/dashboard?q=<encoded>` on every page; Réception
(`index.tsx`) reads `?q=` in its `searchInput` useState initializer on mount. So the header search
always lands on the inbox with the query applied — it does NOT filter the current non-inbox page.
