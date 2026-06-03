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

## Ouvrir LE mail exact depuis un webmail sans API ni Message-ID
- **OVH « Pro » = OWA/Exchange** (`pro3.mail.ovh.net/owa/#path=/mail`), PAS Roundcube. Les sélecteurs Roundcube ne matchent pas ; OWA n'expose ni le Message-ID RFC822 ni d'ID natif dans le DOM → impossible de résoudre par ID exact comme Gmail/Outlook.
  **Why:** Gmail/Outlook donnaient l'ID via leur API d'add-on ; un webmail générique gratté côté DOM n'a aucun ID fiable.
- **Repli universel `resolve-email` = sujet + expéditeur** (gratté du DOM). Le backend retrouve le mail le plus récent dont `sender` contient l'adresse ET dont le sujet normalisé (préfixes Re:/Fwd:/Tr:… retirés) correspond.
  **How to apply:** rester STRICT — exiger À LA FOIS l'adresse e-mail de l'expéditeur ET un sujet significatif (≥5 ch), rejeter sujets vides, n'accepter le partiel que si les deux sujets ≥8 ch et l'un contient l'autre. Sinon renvoyer `emailId:null` (ouvre la Réception) plutôt que risquer d'ouvrir le MAUVAIS mail.
  **Why:** sans cette double exigence, un match sujet-seul (ou sujet vide) ouvre un mail au hasard. C'est le piège signalé en revue.
- Côté extension : gratter l'expéditeur via lien `mailto:` en priorité puis 1ère adresse e-mail en tête de la zone de lecture (`[role=main]`/reading pane), et le sujet via 1er `[role=heading]`/h1/h2. Envoyer `subject`+`from` à `resolve-email` ET à `prefetchEmailId`.

## Reste à faire (plan validé user)
Étape 2 = adaptateurs de lecture par webmail (Roundcube/OVH d'abord, puis Yahoo/GMX/Zoho/iCloud/Zimbra + bonus Gmail/Outlook web). Étape 3 = section installation dans Paramètres → Mon compte + i18n + base URL dynamique. Étape 4 = packaging + publication Chrome/Edge (compte dev Chrome ~5 $ une fois), Firefox ensuite.
