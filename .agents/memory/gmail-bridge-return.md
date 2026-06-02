---
name: Gmail add-on ↔ app bridge (aller + retour)
description: Round-trip Inboria↔Gmail — ouverture exacte d'un mail, accès sans mail ouvert, et bandeau de retour
---

# Pont Gmail ↔ Inboria

## Aller (Gmail → Inboria)
L'add-on ouvre l'app avec `?from=gmail` (+ `emailId` si le mail est résolu). Le bouton « ↗ Ouvrir Inboria » existe sur DEUX cartes de l'add-on : la carte d'un mail ouvert ET la carte d'accueil (`onHomepage`/`buildAskCard_`) — important : sans cet ajout, on ne peut ouvrir Inboria qu'en ayant un mail ouvert. La carte d'accueil réutilise `handleOpen_`, qui gère `emailId=null` → ouvre `/dashboard?from=gmail`.

## Retour (Inboria → Gmail), 2 niveaux
1. **Détail d'un mail** : bouton « Retour à Gmail » qui ouvre le **mail EXACT** via `#search/rfc822msgid:<ID>`. Gmail a un deep-link fiable vers un message précis — **Outlook n'en a pas** (différence clé entre les deux ponts).
2. **Réception / partout** : bandeau `GmailReturnBanner` (miroir de `OutlookReturnBanner`, monté dans `dashboard-layout`) — utile car on atterrit souvent en Réception quand le mail n'est pas résolu dans Inboria.

## Pièges durables
- **Le bandeau retire `?from` de l'URL au montage** (replaceState) et persiste un flag `sessionStorage["inboria.fromGmail"]`. Donc tout code qui dépendait de `?from=gmail` (ex. le bouton du détail) DOIT lire le flag sessionStorage en plus du param URL, sinon il disparaît après le strip. Le bandeau ne supprime QUE `from` (jamais `emailId`).
- **Retour onglet** : l'app est ouverte dans un nouvel onglet par l'add-on → `window.close()` pour rendre le focus à Gmail. `window.close()` peut être refusé (onglet non « opened by script ») ; fallback = naviguer Gmail **dans le même onglet** (`location.href`), seulement si `!window.closed` après court délai — jamais `window.open` (popup blocker).
- **Résolution mail Gmail→Inboria : préférer l'ID NATIF, pas le Message-ID RFC822.** `handleOpen_` lisait le Message-ID via `getHeader_` = un appel UrlFetchApp SÉPARÉ à `gmail.googleapis.com` qui échoue silencieusement (renvoie "") → `resolveEmailId_` court-circuite SANS jamais toucher le backend (symptôme : ZÉRO requête `/api/inboria/resolve-email` côté serveur alors que l'utilisateur clique). Fix durable : l'add-on a TOUJOURS `e.gmail.messageId` (ID natif, 0 appel API) → l'envoyer en `nativeMessageId`. Le backend matche `emails.external_id` (`gmail:<id>` / `outlook:<id>`, sinon suffixe `%:<id>`). RFC822 (`provider_message_id`) reste un bonus best-effort. **Why :** un add-on qui dépend d'un appel API tiers fragile pour construire un deep-link tombera en fallback Réception dès que cet appel échoue (scope/token). **How to apply :** pour tout deep-link add-on→app, router par l'identifiant déjà présent dans l'event, jamais par un header nécessitant un 2e appel.
- **Source du Message-ID** = `emails.provider_message_id` (header RFC822, stocké avec OU sans chevrons → strip `<>` + encode). Règle durable : `GET /api/emails/:id` construit un objet de réponse **camelCase explicite** (pas de passthrough `select *`) — tout champ DB utile au front doit être ajouté à ce mapping.
- **Limite assumée** : lien Gmail sur `mail/u/0` (1er compte). Multi-compte non garanti ; option produit choisie = recherche par Message-ID.
