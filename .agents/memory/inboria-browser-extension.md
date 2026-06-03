---
name: Inboria browser extension (« Demander à Inboria » webmail)
description: How the Chrome/Edge extension bridge is wired and the gotchas for distributing it.
---

# Inboria browser extension — « Demander à Inboria » dans tous les webmails

Source : `artifacts/ncv-mail/public/inboria-extension/` (manifest MV3, `content.js`, `content.css`, `panel.html/.css/.js`, icônes copiées de `logo-icon-192.png`).

## Architecture
- **Réutilise le même contrat serveur que l'add-in Outlook + l'add-on Gmail** : `GET /api/inboria/addin-config` (config Supabase publique), `POST /api/inboria/chat`, `GET /api/inboria/resolve-email`. **Aucun nouveau backend** n'a été nécessaire pour le socle.
- `content.js` (monde isolé, top frame) détecte un webmail, injecte un bouton flottant + un **iframe** `panel.html` (web_accessible_resource, donc origine `chrome-extension://`). Communication `content.js` ↔ panneau par **postMessage** (`source:'inboria-content'` / `source:'inboria-panel'`).
- Le panneau s'authentifie via Supabase email/mot de passe (comme le taskpane), session en `localStorage` de la page extension.

## Gotchas / décisions durables
- **CORS** : le panneau tourne en page d'extension (origine `chrome-extension://`) ⇒ avec `host_permissions: https://*/*`, les `fetch` cross-origin (Inboria + Supabase) **contournent CORS sans modif serveur**. Ne PAS croire qu'il faut ajouter des en-têtes CORS côté API pour ça.
  **Why:** un content-script normal subirait CORS, mais le panneau est une page d'extension privilégiée.
- **`window.rcmail` invisible depuis le content-script** (monde isolé) → la détection Roundcube se fait par **signatures DOM** (`#rcmbody`, `#messagelist`, meta generator Roundcube…), pas par variables JS de la page.
- **Roundcube body lisible** : la vue message est dans une iframe **même origine** (`#messagecontframe`/`#messageframe`) → `contentDocument.body.innerText` accessible depuis le top frame.
- **`INBORIA_BASE` est codé en dur dans `panel.js`** (actuellement le domaine de DEV `*.replit.dev`). Le dev domain ne marche QUE quand le workspace tourne. **Pour distribuer (stores), il FAUT le remplacer par le domaine publié.** Prévoir (comme l'add-on Gmail `__INBORIA_BASE__`) une substitution au téléchargement depuis l'app.
- `zip` CLI absent de l'env → packager le .zip via **python `zipfile`**, pas `zip`.
- Manifest de TEST volontairement large (`matches`/`host_permissions: https://*/*`) → **à restreindre** à une liste de webmails avant soumission aux stores.

## Reste à faire (plan validé user)
Étape 2 = adaptateurs de lecture par webmail (Roundcube/OVH d'abord, puis Yahoo/GMX/Zoho/iCloud/Zimbra + bonus Gmail/Outlook web). Étape 3 = section installation dans Paramètres → Mon compte + i18n + base URL dynamique. Étape 4 = packaging + publication Chrome/Edge (compte dev Chrome ~5 $ une fois), Firefox ensuite.
