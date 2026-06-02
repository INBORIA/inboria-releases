---
name: Outlook add-in → app return flow
description: How "Ouvrir dans Inboria" returns to Outlook, and the window.close() caveat
---

# Retour Outlook depuis l'app (pont Inboria)

Le taskpane Outlook ouvre l'app via `Office.context.ui.openBrowserWindow(url)` (fallback `window.open`). L'URL porte `?from=outlook` (+ `emailId` si résolu). Côté app, `OutlookReturnBanner` (monté dans `dashboard-layout` `<main>`) détecte `from=outlook`, persiste un flag `sessionStorage["inboria.fromOutlook"]` (car le param d'URL est retiré au montage), et affiche un bandeau « Revenir à Outlook ».

**Caveat window.close():** un onglet ouvert par `openBrowserWindow` n'est PAS toujours « opened by script » côté navigateur → `window.close()` peut être refusé silencieusement. Le bandeau masque alors juste lui-même ; l'utilisateur rebascule manuellement sur l'onglet Outlook (qui reste ouvert). C'est pourquoi le texte du bandeau mentionne explicitement les deux options. Ne pas promettre une fermeture garantie.

**Why:** Outlook web reste ouvert dans son propre onglet ; il n'existe pas de deep-link fiable pour rouvrir le message précis dans Outlook, donc « revenir » = fermer/rebasculer, pas naviguer.
