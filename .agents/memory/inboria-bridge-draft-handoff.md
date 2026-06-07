---
name: Inboria bridge draft handoff (Outlook strips URL fragment)
description: Why "Modifier dans Inboria" must hand off the proposed draft via a server token in the query string, never via the URL fragment.
---

# Pont « Modifier dans Inboria » — transport du brouillon ponts → app web

**Règle :** pour passer un brouillon depuis un pont (add-in Outlook / add-on Gmail / extension) vers l'app web ouverte dans le navigateur, NE PAS utiliser le fragment d'URL (`#inboria-draft=...`). Utiliser un **jeton serveur éphémère** passé en **query** (`?draft=<token>`).

**Why :** `Office.context.ui.openBrowserWindow` (Outlook) **ne préserve PAS le fragment** `#...` — le composeur s'ouvrait vide. Même symptôme côté Gmail (add-on `OpenLink` ouvre un nouvel onglet) et extension (`window.open`/tabs) : ouverture d'un nouvel onglet + **danse d'auth `/login`** font perdre le hash. Indice de diagnostic : les deep-links qui passent par la query (`?emailId=`, `?from=`) marchent, ceux qui passent par le hash échouent. La query survit à la redirection d'auth car capturée au boot dans `main.tsx` et stockée en sessionStorage avant le routing React.

**Statut :** les **3 ponts** (Outlook `taskpane.js`, Gmail `Code.gs handleOpen_`, extension `panel.js openDraftInApp`) sont sur le jeton query, repli fragment conservé. Gmail POST via `apiFetch_` (Apps Script, renvoie JSON parsé / throw >=400) ; extension via `apiFetch` (fetch, lire `r.ok ? r.json()`). Rappel déploiement : Code.gs doit être recollé dans Apps Script et l'extension rechargée/rezippée — ces fichiers `public/` ne sont pas servis en live aux ponts déjà installés.

**Pourquoi pas la query brute (sans jeton) :** mettre le corps du mail directement en query le ferait apparaître dans les journaux d'accès serveur (préoccupation RGPD B2B). Le jeton est opaque → aucun contenu de mail en clair dans l'URL/les logs.

**How to apply :** le pont POST le brouillon → reçoit `{token}` → ouvre `?draft=token`. L'app capture le jeton au boot, puis le Dashboard récupère le brouillon via l'API et pose `composePrefill` AVANT d'ouvrir le composeur (ComposeDialogBody lit `initialBody` au montage uniquement). Store serveur = Map en mémoire, TTL court, usage unique, scoped userId. Limite connue : process-local (perdu au restart entre POST et GET) — acceptable car consommé immédiatement ; passer à un store partagé (Redis/table) si multi-instance. Garder le fragment en repli si le POST échoue.
