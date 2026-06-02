---
name: Gmail add-on → app return flow
description: How "Retour à Gmail" reopens the EXACT message, and why it differs from Outlook
---

# Retour Gmail depuis l'app (pont Inboria)

L'add-on Gmail ouvre l'app via `?from=gmail` (+ `emailId`). Côté app, le header `EmailDetail` détecte `from=gmail` et affiche un bouton « Retour à Gmail » qui ouvre le **mail exact** avec l'opérateur de recherche Gmail `#search/rfc822msgid:<ID>`.

**Différence majeure avec Outlook :** Gmail EXPOSE un deep-link fiable vers un message précis (opérateur `rfc822msgid:`), ce qu'Outlook n'a PAS. Donc côté Gmail on navigue vraiment vers le message ; côté Outlook on se contente de rebasculer/fermer l'onglet.

**Source du Message-ID :** colonne `emails.provider_message_id` (= header RFC822 Message-ID, stocké tantôt avec chevrons `<...>` tantôt sans). Avant cette feature elle n'était PAS renvoyée au front : `GET /api/emails/:id` construit un objet camelCase explicite (pas un passthrough `select *`), il a fallu y ajouter `providerMessageId`. Pour tout nouveau champ utile au front, penser à l'ajouter à ce mapping explicite.

**Construction du lien :** strip `<>`, `trim()`, `encodeURIComponent`. Fallback `mail/u/0/#inbox` si pas d'ID.

**Limite connue (acceptée) :** le lien cible `mail/u/0` (1er compte Google). En multi-compte Gmail le bon compte n'est pas garanti. Choix produit assumé = option « recherche par Message-ID » ; propager l'index/adresse de compte depuis l'add-on serait l'amélioration si « exact multi-compte » devient une exigence.
