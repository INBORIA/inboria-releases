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

## Adaptateurs par webmail (Étape 2) — architecture
- `content.js` n'a PAS d'adaptateurs « lourds » : une heuristique UNIVERSELLE unique (`scrapeContext`) + une table additive `WEBMAIL_ADAPTERS` (Yahoo, GMX/Web.de/mail.com, Zoho, Zimbra, Proton, Fastmail, iCloud). `applyAdapter(ctx)` tourne EN PREMIER (après la sélection, avant Roundcube + heuristiques) et chaque adaptateur ne fait que REMPLIR les champs vides (`if (!c.subject) …`).
  **Why:** un adaptateur dont les sélecteurs sont faux/obsolètes ne peut que rester no-op → le repli universel reprend la main → jamais de régression sur les webmails qui marchent déjà (Gmail/Outlook/Roundcube/OVH).
  **How to apply:** pour ajouter un webmail, pousser une entrée `{match(h), read(c)}` dans `WEBMAIL_ADAPTERS` ; ne JAMAIS écraser un champ déjà rempli, ne jamais retirer le repli universel. Helpers : `qText([sels])` (1er sélecteur non vide) et `frameBody([iframe sels])` (corps en iframe MÊME ORIGINE — GMX/Zimbra/Zoho/Proton/iCloud).
- Sélecteurs « best-effort » écrits SANS captures réelles → à valider/affiner webmail par webmail (les éditeurs changent leurs classes). Le manifest est déjà `https://*/*` donc aucun nouveau host à déclarer.

## Reste à faire (plan validé user)
Étape 2 = ✅ socle adaptateurs en place (à affiner avec captures réelles par webmail). Étape 3 = section installation dans Paramètres → Mon compte + i18n + base URL dynamique. Étape 4 = packaging + publication Chrome/Edge (compte dev Chrome ~5 $ une fois), Firefox ensuite.

## Ouvrir un mail depuis un pont = NE PAS dépendre du jeton du pont
Le bouton « Ouvrir dans Inboria » ne doit jamais dépendre du jeton (Bearer Supabase)
stocké dans l'extension/add-in/add-on : ce jeton peut renvoyer 401 (rotation du
refresh-token quand l'app web Inboria tourne en parallèle et fait tourner le jeton
partagé), et l'ouverture retombe alors sur la Réception.
**Règle** : le pont transmet les identifiants BRUTS du mail dans l'URL de l'app web,
et c'est l'app web — authentifiée par SA PROPRE session — qui résout l'emailId.
**Piège** : le paramètre `from` sert déjà de marqueur de pont (`from=extension|gmail|outlook`),
donc l'expéditeur/sujet bruts doivent utiliser des noms distincts (préfixe `x*` :
`xfrom`/`xsubject`/`xmid`/`xnid`) sinon `URLSearchParams.get("from")` renvoie le marqueur.
Côté app : capture au boot dans `sessionStorage["inboria.pendingResolve"]` (TTL court),
effet one-shot qui résout via `/api/inboria/resolve-email` puis `setSelectedEmailId`.

## SPA context refresh (panneau collé sur l'ancien mail)
- Webmails SPA (OWA/OVH, Gmail) NE rechargent PAS la page au changement de mail → content.js doit re-scraper activement, sinon le panneau garde le 1er mail capté et le chat répète la même réponse.
- Détection = MutationObserver(document.body, childList+subtree) débit-limité 400ms + history pushState/replaceState + hashchange/popstate + sondage de secours 1.5s. N'émettre `type:context` au panneau QUE si la clé `subject||from||bodyLen` change.
- LIFECYCLE STRICT (exigence architect) : toute la surveillance s'attache dans startWatch (openPanel) et se démonte dans stopWatch (closePanel) — y compris removeEventListener URL et RESTAURATION des history.pushState/replaceState originaux. Ne JAMAIS laisser un monkeypatch history permanent sur le webmail hôte.
- Côté panel.js : à réception `type:context` il fait déjà currentContext = ... + prefetchEmailId() → aucun changement panneau nécessaire.

## « Invalid or expired token » sur les actions chat (panel.js)
- L'extension cachait l'access_token et le considérait valide tant que `expires_at` était futur, mais le serveur (requireAuth → supabaseAdmin.auth.getUser) pouvait le rejeter (jeton rotaté/invalidé côté Supabase, ex. login web du même compte) → 401 « Invalid or expired token » affiché brut, sans refresh ni logout.
- FIX : apiFetch rejoue UNE fois après refresh() forcé sur 401 (param interne _retried) ; si le refresh échoue → throw "refresh failed". Et le catch de sendUserMessage déconnecte aussi sur "invalid or expired token"/"authentication failed" (regex élargie) → retour écran connexion au lieu d'un message cryptique.
- Règle durable : tout client Supabase « maison » (extension/add-in) doit gérer le 401 serveur par refresh-and-retry, pas seulement se fier au TTL local de l'access_token.

## Réponses non-JSON (« Unexpected token '<' », <!DOCTYPE)
- Sur le dev domain Replit (INBORIA_BASE codé en dur dans panel.js), une requête peut recevoir une page HTML (interstitiel/502/redirection) au lieu de JSON → r.json() plante avec « Unexpected token '<' ».
- FIX : helper readJson(r) = r.text() puis JSON.parse en try/catch ; sur échec → erreur lisible, et "invalid or expired token" si status 401 (déclenche logout via la regex du catch). À utiliser pour TOUT parsing de réponse utilisateur-facing dans l'extension.
- Per-webmail : Gmail OK. OVH (Roundcube vs Exchange/OWA) = détection du changement de mail encore à fiabiliser selon le DOM réel (le scrape peut lire du contenu page-level non spécifique au mail ouvert → contexte « collé »). Demander capture d'écran avant de cibler les sélecteurs (risque de régresser Gmail/Outlook qui marchent).

## Bridge surfaces strip card-button hints
The shared `/api/inboria/chat` prompt (inboria-context.ts) tells the model to append "Cliquez sur Envoyer/Modifier/Bloquer dans la carte ci-dessus…" after each `inboria-draft`/`inboria-meeting`/`inboria-multi-meeting`/`inboria-hold-meeting` block. Those hints are only valid in the **in-app React chatbot**, which renders the block as an interactive card with real buttons. The **bridge** surfaces (extension `panel.js` `cleanReply`, Gmail add-on `Code.gs` `cleanReply_`) render the block as PLAIN TEXT — no card, no buttons — so they must strip the hint sentences or the user is told to click UI that doesn't exist. Strip regex (accent-tolerant): `/Cliquez sur [^.]*\b(?:Envoyer|Bloquer)\b[^.]*\.(?:\s*(?:Inboria|Le RDV)[^.]*\.)?/gi`. **Why server-side strip is wrong:** the same endpoint serves the in-app card (where the hint is correct) and bridges don't pass a surface flag → fix belongs in each bridge's reply cleaner. Trade-off: Gmail add-on needs Apps Script redeploy + extension reload to pick it up.

## Bridges now render drafts as a real card with Send/Edit buttons
Decision (supersedes the "strip the hint" approach for inboria-draft only): the three bridges (add-in `taskpane.js`, extension `panel.js`, Gmail add-on `Code.gs`) now render an `inboria-draft` block as a preview card with two REAL buttons — « Envoyer » (POST /api/emails/send, compte connecté, threading via replyToEmailId) and « Modifier dans Inboria » (opens the mail). RDV/meeting blocks still render as plain text (hint still stripped). callChat now returns RAW reply (not cleanReply); the reply cleaner only runs on the non-draft path.
**Why two non-obvious traps cost a code-review round:** (1) `/api/emails/send` validates a STRICT email regex → any sender fallback must normalize « Nom <email> » to the bare address (extractEmail helper) or it 400s; bare `currentContext.from` / `getFrom()` is often the display-name form. (2) the Send button must reuse the SAME 401 handling as the chat path (clear session + show login) — easy to forget because it's a separate code path from sendUserMessage.
**How to apply:** keep the 3 bridges in parity — any new chat-reply affordance needs all three, plus Gmail add-on redeploy + extension reload to take effect. Apps Script passes draft to/subject/body via CardService action setParameters (strings; fine for short emails).
