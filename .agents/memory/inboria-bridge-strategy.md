---
name: Inboria bridge — "Demander à Inboria" coverage per mailbox type
description: Which mechanism delivers the "Demander à Inboria" panel for each email provider/account type, and what it takes to enable each. Product strategy decision, not implementation detail.
---

# Inboria "pont" — couvrir « Demander à Inboria » dans TOUS les cas

**Objectif produit (user, juin 2026) :** offrir la fenêtre « Demander à Inboria »
quel que soit le fournisseur mail du client. Aucun mécanisme UNIQUE ne couvre tout
(c'est une contrainte de l'écosystème mail, pas une limite d'Inboria — même
Superhuman/Missive ne peuvent pas injecter un panneau dans un webmail IMAP tiers).
La couverture 100 % vient d'une **combinaison** + l'app comme filet universel.

## Règle décisive
Ce qui décide, ce n'est PAS le logiciel qui affiche le mail (Outlook desktop,
navigateur…), c'est le **TYPE de la boîte** (le serveur derrière).

## Carte par cas — quoi faire pour chacun

| Type de boîte | Mécanisme | Statut / ce qu'il faut faire |
|---|---|---|
| Microsoft (Outlook.com, Hotmail, M365) | **Add-in Outlook** | ✅ Fait. Sideload du manifest. Marche. |
| **Vrai Exchange hébergé** (y compris **OVH Hosted Exchange**, Exchange on-prem 2013+) | **Add-in Outlook** (même manifest) | ✅ Possible — l'add-in marche sur TOUTE vraie boîte Exchange, pas que M365. Déploiement add-in via Exchange admin center OU sideload OWA. |
| OVH **Email Pro** | Add-in Outlook (à tester) | ⚠️ « basé sur Microsoft » mais allégé → support add-ins INCERTAIN, vérifier au cas par cas. |
| OVH **MX Plan / Email** = IMAP pur | ❌ Pas d'add-in | Couvert par app Inboria + (futur) extension navigateur. |
| Gmail / Google Workspace | **Add-on Gmail** (Apps Script CardService) | Phase 2 — en cours. |
| Webmail IMAP **lu dans un navigateur** (OVH webmail, Yahoo, IONOS…) | **Extension navigateur** (Chrome/Edge/Firefox) | Chantier futur, APRÈS Outlook+Gmail. Bouton flottant simple = facile ; lecture auto du mail affiché = adaptation PAR webmail. Ne marche PAS dans un logiciel installé (Thunderbird/Apple Mail/Outlook desktop) car pas une page web. |
| **N'importe quoi, partout** | **L'app Inboria elle-même** | ✅ Filet universel — tous les comptes y sont déjà connectés. Aucun cas laissé de côté. |

## Le point qui rassure le user
Pour avoir l'add-in sur une adresse OVH : **on ne migre PAS vers Outlook.com et on
ne quitte PAS OVH**. Le nom de domaine RESTE chez OVH. On change seulement l'**offre
email derrière le domaine** : passer de « Email/MX Plan » à « OVH Hosted Exchange ».
La boîte devient alors une vraie boîte Exchange → l'add-in s'affiche dedans.
Revers honnête : c'est une bascule d'infra (migration de boîte entre offres OVH,
coût/boîte/mois, changement de MX), pas un simple réglage.

## Diagnostic du type de boîte OVH via DNS (sans accès au compte)
- DNS direct bloqué dans le sandbox → utiliser Google DoH : `curl -s "https://dns.google/resolve?name=<domaine>&type=MX"`.
- **Signature MX Plan / IMAP** : MX = serveurs **numérotés** `mx0..mx4.mail.ovh.net` + SPF `include:mx.ovh.com`. (Constaté juin 2026 sur xchangesuite.com et inboria.com → IMAP, donc pas d'add-in sur ces 2 domaines aujourd'hui.)
- **Hosted Exchange OVH** : MX **différent**, du type `<domaine>.mail.ovh.net` (propre au domaine), pas les `mxN` génériques.

## Convention URL des add-ins web (Outlook + Gmail)
- ncv-mail a `BASE_PATH="/"` (previewPath `/`) ; l'API est un **artifact séparé** routé à `/api` sur la **racine du domaine** (pas sous le base path du SPA).
- Donc tout add-in externe (taskpane Outlook, Apps Script Gmail) utilise `window.location.origin` pour les appels API **et** les deep-links `/dashboard?emailId=...` — JAMAIS un préfixe `import.meta.env.BASE_URL`. C'est la convention de l'add-in Outlook validé ; la répliquer.
- Génération add-on Gmail : fichiers statiques `public/inboria-gmail-addon/{Code.gs,appsscript.json}` avec placeholder `__INBORIA_BASE__` remplacé côté front par `window.location.origin` au moment du téléchargement/copie. Exclure ce dossier du service worker PWA (globIgnores + navigateFallbackDenylist + runtimeCaching guard), comme `inboria-addin/`.
- Gmail `uiLang` doit venir de `e.commonEventObject.userLocale` (split "-"), repli "fr" — pas de langue en dur.
