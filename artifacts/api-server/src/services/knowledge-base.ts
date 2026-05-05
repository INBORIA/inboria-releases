export function getKnowledgeBase(language: "fr" | "en" | "nl" | "de" | "es" | "it" | "pt" | "pl" | "ro" | "sv" | "da" | "fi" | "hu" | "cs" | "tr" | "ja" | "ko" | "vi" | "th" | "id" | "ms" | "el" | "uk" | "et" | string): string {
  const kb: Record<string, string> = {
    fr: `# Inboria — Base de connaissances complète

## Présentation générale
Inboria est un assistant email intelligent propulsé par l'IA, conçu pour les PME en Belgique et en France. Il trie, classe et résume automatiquement vos emails professionnels. L'application fonctionne en français, anglais et néerlandais.

## 1. RÉCEPTION (Boîte de réception)
La page principale affiche tous vos emails entrants avec tri intelligent par l'IA.

### Fonctionnalités :
- **Tri par priorité** : Chaque email reçoit automatiquement une priorité (Urgent 🔴, Moyen 🟡, Faible 🟢) attribuée par l'IA.
- **Résumé IA** : Chaque email a un résumé court généré par l'IA, visible sans ouvrir l'email.
- **Catégorisation automatique** : L'IA classe les emails dans des catégories (Factures, Support client, Commercial, etc.).
- **Recherche** : Barre de recherche pour trouver un email par expéditeur, sujet ou contenu.
- **Filtres** : Filtrer par catégorie, priorité, statut (lu/non-lu, archivé).
- **Actions sur un email** : Répondre, Archiver, Supprimer, Créer une tâche, Créer un RDV.
- **Sélection multiple** : Sélectionner plusieurs emails pour archiver ou supprimer en lot.
- **Composer un email** : Bouton pour rédiger un nouvel email avec assistance IA (brouillon IA).
- **Brouillon IA** : L'IA peut générer un brouillon de réponse basé sur le contexte de l'email. Cliquez sur l'icône baguette magique.
- **Pièces jointes** : Voir et télécharger les pièces jointes reçues. Ajouter des pièces jointes lors de l'envoi.
- **Commentaires** : Ajouter des notes internes sur un email (visibles uniquement par vous et votre équipe).
- **Assigner** : Assigner un email à un membre de l'équipe (plan Business uniquement).
- **Pagination** : Les emails se chargent par lots de 50 pour de meilleures performances.

### Comment ça marche :
1. Connectez votre boîte email dans Paramètres (Gmail OAuth ou IMAP).
2. Inboria synchronise vos emails automatiquement toutes les 5 minutes.
3. L'IA analyse chaque email : priorité, catégorie, résumé.
4. Vous voyez vos emails triés intelligemment dans la boîte de réception.

## 2. ENVOYÉS
Affiche tous les emails que vous avez envoyés depuis Inboria.

### Fonctionnalités :
- Liste des emails envoyés avec destinataire, sujet, date.
- Recherche dans les emails envoyés.
- Voir le contenu complet d'un email envoyé.
- Voir les pièces jointes envoyées.

## 3. TÂCHES
L'IA détecte automatiquement les tâches à faire dans vos emails et les liste ici.

### Fonctionnalités :
- **Tâches IA** : Détectées automatiquement dans vos emails (ex: "Merci d'envoyer le devis" → tâche créée).
- **Tâches manuelles** : Vous pouvez aussi créer des tâches manuellement avec titre et description.
- **Filtrer** : Voir toutes les tâches, uniquement les tâches IA, ou uniquement les manuelles.
- **Badges** : Compteurs pour le total, IA et manuelles.
- **Marquer comme fait** : Cochez une tâche pour la marquer comme terminée.
- **Voir l'email source** : Pour les tâches IA, cliquez pour voir l'email d'origine.
- **Exporter CSV** : Exportez toutes vos tâches en fichier CSV.

## 4. PROJETS
Organisez vos emails par projet pour un suivi thématique.

### Fonctionnalités :
- **Créer un projet** : Donnez un nom et une description à votre projet.
- **Associer des emails** : Depuis la boîte de réception, assignez un email à un projet.
- **Vue projet** : Voir tous les emails associés à un projet donné.
- **Statut du projet** : Actif ou archivé.

## 5. AGENDA / CALENDRIER
Vue calendrier avec détection automatique des rendez-vous par l'IA.

### Fonctionnalités :
- **Vues** : Jour, Semaine, Mois — changez la vue avec les boutons en haut.
- **Détection IA** : L'IA analyse vos emails et détecte automatiquement les rendez-vous mentionnés.
- **Suggestions IA** : Les RDV détectés apparaissent comme suggestions que vous pouvez confirmer ou ignorer.
- **Créer manuellement** : Créez un RDV manuellement avec titre, date, heure, lieu et participants.
- **RDV du jour/demain** : Panneau latéral montrant les prochains RDV.
- **Exporter CSV** : Exportez votre agenda en CSV.
- **Voir l'email source** : Pour les RDV détectés par l'IA, accédez à l'email d'origine.

## 6. ARCHIVES
Emails que vous avez archivés. Ils ne sont plus dans la boîte de réception mais restent accessibles.

### Fonctionnalités :
- Liste des emails archivés.
- Recherche dans les archives.
- Restaurer un email archivé (le remettre dans la boîte de réception).
- Suppression définitive.
- Corbeille avec option "Vider la corbeille".

## 7. BILAN QUOTIDIEN
Résumé quotidien généré par l'IA de votre activité email.

### Fonctionnalités :
- **Résumé IA** : Vue d'ensemble de vos emails du jour (nombre reçus, urgents, traités).
- **Points d'attention** : L'IA identifie les emails importants nécessitant votre attention.
- **Statistiques** : Graphiques de votre activité email.
- **Santé de la boîte** : Indicateur de santé de votre boîte (emails en attente, temps de réponse moyen).
- **Générer** : Cliquez sur le bouton pour générer/régénérer le bilan du jour.

## 8. CLASSEMENT (Catégories)
Gérez les catégories utilisées par l'IA pour classer vos emails.

### Fonctionnalités :
- **Catégories par défaut** : Factures, Support, Commercial, Admin, Personnel, etc.
- **Packs métiers** : 50+ packs métiers disponibles (Comptable, Avocat, Restaurant, Immobilier, etc.). Chaque pack ajoute des catégories spécifiques à votre secteur.
- **Pack IA** : Entrez votre métier et l'IA génère des catégories personnalisées.
- **Créer/Modifier/Supprimer** : Gérez vos catégories manuellement.
- **Mots-clés** : Chaque catégorie peut avoir des mots-clés pour aider l'IA à mieux classer.
- **Recatégoriser** : Bouton pour relancer la catégorisation IA sur les emails non classés.

## 9. PARAMÈTRES
Configuration de votre compte et connexions email.

### Sections :
- **Profil** : Modifier votre nom et signature email.
- **Connexions email** : 
  - Connecter Gmail (via OAuth, authentification sécurisée Google).
  - Connecter via IMAP : Outlook, Hotmail, Orange, Free, SFR, Yahoo, Proximus, Telenet, iCloud, OVH, IONOS, Infomaniak, et plus.
  - Voir la liste de vos connexions actives.
  - Supprimer une connexion.
- **Notifications** : Activer/désactiver les notifications email.
- **Préférences IA** : Configurer le comportement de l'IA (langue de résumé, etc.).
- **Langue** : Choisir la langue de l'interface (Français, English, Nederlands).
- **Sécurité** : Changer votre mot de passe.

### Fournisseurs IMAP supportés :
Gmail, Outlook, Hotmail, Orange, Free, SFR, Bouygues, La Poste, Yahoo, Proximus, Skynet, VOO, Telenet, OVH, IONOS, Infomaniak, GMX, iCloud, et "Autre" (configuration manuelle).

## 10. ABONNEMENT
Gestion de votre plan et paiement.

### Plans disponibles :
- **Essai** : Gratuit, 100 emails IA inclus. Parfait pour tester.
- **Starter** : 9€/mois, 500 emails/mois, 1 boîte email.
- **Pro** : 19€/mois, 2000 emails/mois, 3 boîtes email. (Recommandé)
- **Business** : 39€/mois par siège, emails illimités, boîtes illimitées, boîtes partagées, gestion d'équipe.

### Fonctionnalités :
- Voir votre plan actuel et utilisation (crédits IA utilisés / total).
- Changer de plan (upgrade/downgrade).
- Paiement sécurisé via Paddle (carte bancaire).
- Annuler l'abonnement.
- Historique de facturation.

## 11. BOÎTES PARTAGÉES (Plan Business uniquement)
Boîtes email partagées entre membres de l'équipe.

### Fonctionnalités :
- Créer une boîte partagée (ex: contact@, info@, support@).
- Assigner des membres de l'équipe à la boîte.
- Voir les emails de la boîte partagée.
- Réclamer un email (se l'assigner pour le traiter).
- Libérer un email (le remettre disponible pour l'équipe).

## 12. GESTION D'ÉQUIPE (Plan Business uniquement)
Gérez les membres de votre organisation.

### Fonctionnalités :
- Inviter des membres par email.
- Définir les rôles : Admin ou Membre.
- Voir la liste des membres avec leur statut.
- Retirer un membre de l'équipe.
- Voir l'activité de l'équipe (emails traités, tâches complétées).

## 13. ACTIVITÉ ÉQUIPE (Plan Business uniquement)
Suivi de l'activité des membres de votre organisation.

### Fonctionnalités :
- Vue d'ensemble de l'activité de chaque membre.
- Emails traités par membre.
- Tâches complétées.

## 14. MANUEL D'UTILISATION
Guide intégré dans l'application expliquant toutes les fonctionnalités.

### Sections du manuel :
- Démarrage rapide
- Connexion email
- Boîte de réception et tri IA
- Agenda (calendrier, détection IA, vues, export CSV)
- Tâches (filtre IA, badges, création manuelle, export CSV)
- Envoyés
- Classement et catégories
- Bilan quotidien
- Paramètres
- Abonnement
- Sections Business (boîtes partagées, équipe)

## 15. SPAM ET FILTRAGE IA
Inboria utilise un filtrage en plusieurs couches pour éviter le bruit dans votre boîte tout en économisant vos crédits IA.

### Pré-filtre déterministe (avant l'IA) :
- **Motif noreply / notifications** : Les adresses dont la partie locale correspond à des motifs comme noreply, no-reply, donotreply, notification(s), alerts, mailer-daemon, postmaster, newsletter, bounce, digest, broadcast… sont automatiquement reconnues et classées dans la catégorie « Notifications ».
- **Cache d'expéditeurs** : La table sender_cache mémorise pour chaque expéditeur déjà vu sa catégorie et sa priorité. Le second email du même expéditeur évite donc un appel IA et hérite immédiatement du même classement, ce qui accélère la synchronisation et préserve vos crédits.
- **Détection de spam déterministe** : Avant tout traitement IA, le pré-filtre marque comme spam les emails qui présentent des signaux clairs (adresses commerciales en masse, signatures connues), pour qu'ils n'apparaissent jamais dans la Réception principale.

### Catégorisation automatique en spam :
- **Décision IA** : Les emails non couverts par le pré-filtre passent par GPT-4o-mini, qui peut décider qu'un message est du spam ; il est alors directement déposé dans le dossier Spam au lieu de la Réception.
- **Dossier Spam dédié** : Accessible depuis la barre latérale, il regroupe tous les emails marqués comme spam (par le pré-filtre ou par l'IA).
- **Sans crédit gaspillé** : Un email pré-filtré ne consomme aucun crédit IA — seuls les messages incertains atteignent l'IA.

### Reclassement manuel :
- **Restaurer vers la Réception** : Depuis le dossier Spam, un clic remet un email légitime dans la Réception principale.
- **Marquer comme spam** : Depuis la Réception, vous pouvez forcer un email vers Spam si l'IA s'est trompée.
- **Apprentissage par le cache** : Vos restaurations et marquages alimentent le sender_cache, donc la prochaine fois qu'un email du même expéditeur arrive, il prend la bonne destination sans re-solliciter l'IA.
- **Vider le spam** : Bouton pour supprimer définitivement tous les emails spam d'un coup, avec confirmation obligatoire.
- **Suppression définitive** : Supprimez un email spam individuellement, également avec confirmation.

### Bonnes pratiques :
- Vérifiez le dossier Spam de temps en temps pour récupérer les faux positifs et entraîner le cache.
- Restaurez les emails légitimes plutôt que de les rouvrir : cela met à jour le sender_cache.
- Videz régulièrement le Spam pour garder votre compte léger.

## 16. ENVOI INTELLIGENT (Vague 1)
Trois fonctions complémentaires pour mieux maîtriser vos envois et votre boîte.

### Reporter un email (Snooze)
- **Comment** : Ouvrez un email, cliquez sur l'icône horloge "Reporter" et choisissez une date/heure ou un raccourci (Ce soir, Demain matin, Lundi prochain, Date personnalisée).
- **Effet** : L'email disparaît temporairement de la Réception et réapparaît automatiquement à l'heure choisie, comme un nouveau message non-lu.
- **Où retrouver les emails reportés** : Page **Reportés** dans le menu de gauche (sous Programmés). Vous pouvez les "Désactiver le report" pour les ramener tout de suite.

### Programmer un envoi
- **Comment** : Dans le composer (nouveau ou réponse), cliquez sur la flèche à côté du bouton Envoyer et choisissez "Envoyer plus tard". Sélectionnez date et heure.
- **Effet** : L'email part automatiquement à l'heure prévue. Vous restez libre de l'annuler ou modifier avant l'envoi.
- **Où voir les envois programmés** : Page **Programmés** dans le menu de gauche.

### Annuler un envoi (Undo Send)
- **Comment** : Après avoir cliqué sur Envoyer dans une réponse, un toast apparaît en bas avec un bouton "Annuler" pendant 10 secondes.
- **Effet** : Si vous cliquez Annuler dans les 10s, l'email n'est jamais envoyé. Sinon, il part normalement.

### Suivi d'ouverture (Tracking)
- Indicateur sur les emails envoyés : "Vu" ou "Non vu" selon si le destinataire a ouvert votre email.
- Discret, en respect de la vie privée (pixel transparent invisible).

## 17. TEMPLATES IA (Vague 2)
Bibliothèque de réponses-types réutilisables, avec assistance IA.

### Créer un template
- **Manuellement** : Page **Paramètres → Templates**, bouton "Nouveau template". Donnez un nom, un sujet et un corps. L'IA peut suggérer un nom basé sur le contenu.
- **Depuis un email envoyé** : Dans le composer, après envoi, cliquez sur "Sauvegarder comme template". Le contenu est repris automatiquement.
- **Catégorisation IA** : Chaque template reçoit un tag automatique (devis, relance, rdv, refus, remerciement, suivi, autre).

### Utiliser un template
- **Suggestions automatiques** : Quand vous ouvrez une réponse, un bandeau en haut du composer affiche 1 à 3 templates pertinents pour le contexte de l'email reçu.
- **Insertion en 1 clic** : Cliquez sur la suggestion pour insérer le template dans la réponse.
- **Variables** : Si le template contient des variables (ex: {{prenom}}), elles sont remplies automatiquement quand c'est possible.

### Gérer les templates
- Page **Paramètres → Templates** : liste groupée par catégorie, recherche, édition, suppression.
- Compteur d'utilisation : voyez combien de fois chaque template a servi.

## 18. RÈGLES AUTOMATIQUES (Vague 2)
Automatisez le traitement de certains emails en langage naturel.

### Créer une règle
- **Page** : **Paramètres → Règles**, bouton "Nouvelle règle".
- **En langage naturel** : Tapez par exemple "Si un client mentionne devis, classer en Commercial et m'avertir". L'IA traduit la phrase en règle structurée (conditions + actions).
- **Conditions possibles** : Expéditeur contient X, Sujet contient X, Corps contient X, Catégorie IA = X, Priorité = X.
- **Actions possibles** : Classer dans une catégorie, Marquer prioritaire, Notifier, Archiver, Assigner à un membre, Créer une tâche.

### Tester avant d'activer (Simulateur)
- **Bouton "Simuler"** : Avant d'activer une règle, lancez le simulateur. Il vous montre quels emails des 30 derniers jours auraient été affectés.
- **Sécurité** : Évite les surprises. Si la règle attrape trop d'emails, ajustez les conditions.

### Suivi et rollback
- **Compteur** : Chaque règle affiche le nombre de fois où elle a été déclenchée.
- **Journal d'audit** : Liste de toutes les actions exécutées par les règles ces dernières 24h.
- **Annuler en 1 clic** : Pour chaque action des dernières 24h, bouton "Annuler" qui restaure l'état précédent (ex: catégorie d'origine, statut non-archivé).

### Activer/Désactiver
- Interrupteur sur chaque règle pour la mettre en pause sans la supprimer.

## 19. INTÉGRATIONS CRM

Inboria se connecte nativement à 4 CRM leaders du marché : HubSpot, Pipedrive, Salesforce et Odoo. La synchronisation est bidirectionnelle et automatique.

### CRM supportés
- **HubSpot** : synchronisation des contacts et des deals.
- **Pipedrive** : synchronisation des personnes, deals et organisations.
- **Salesforce** : synchronisation des contacts, comptes et opportunités. Mode Sandbox disponible (toggle au moment de la connexion vers test.salesforce.com) pour tester avant de passer en Production.
- **Odoo** : synchronisation des contacts (res.partner) et opportunités (crm.lead). Authentification par URL d'instance + base de données + login + clé API (générée dans Odoo : Profil → Sécurité du compte → Nouvelle clé API). Pas d'OAuth — Odoo n'expose pas d'OAuth standard.

### Comment connecter un CRM
1. Aller dans Paramètres → CRM.
2. Cliquer sur "Connecter" en face du CRM choisi.
3. Vous êtes redirigé vers la page d'authentification OAuth officielle du CRM.
4. Vous autorisez Inboria à accéder à vos contacts et deals.
5. Une synchronisation initiale s'effectue automatiquement.

### Synchronisation automatique
- **HubSpot et Pipedrive** : synchronisation automatique toutes les 15 minutes en tâche de fond (planificateur \`crm-sync-scheduler\`).
- **Salesforce** : synchronisation initiale au moment de la connexion + bouton manuel "Synchroniser maintenant" disponible à tout moment dans Paramètres → CRM.
- **Bidirectionnelle** : les changements côté CRM remontent dans Inboria, et les nouveaux contacts dans Inboria peuvent être créés dans le CRM.
- **Sync manuelle pour tous les CRM** : bouton "Synchroniser maintenant" dans Paramètres → CRM. Affiche le nombre de contacts et de deals synchronisés.
- **Date de dernière synchro** : visible sur la carte de chaque CRM connecté.

### Ce que voit l'utilisateur dans Inboria
- Quand un email arrive, Inboria identifie automatiquement le contact correspondant dans le CRM connecté.
- Les deals/opportunités en cours avec ce contact sont visibles depuis l'email.
- Les nouvelles informations issues d'une conversation peuvent enrichir le CRM.

### Sécurité OAuth
- **Aucun mot de passe stocké** : Inboria utilise exclusivement OAuth.
- **Tokens chiffrés au repos** dans la base de données.
- **Révocation à tout moment** : depuis le CRM (page Apps connectées) ou depuis Paramètres → CRM dans Inboria.
- **Échanges TLS** chiffrés de bout en bout.

### Spécificités Salesforce
- Toggle Sandbox pour cibler test.salesforce.com (recommandé pour ETI/grands comptes : tester sur une org de Sandbox avant de connecter la Production).
- Compatible Lightning Experience.
- Le badge \`workspaceName\` indique "(Sandbox)" quand la connexion est sur Sandbox.

### Déconnexion
- Bouton "Déconnecter" dans Paramètres → CRM.
- La synchronisation s'arrête immédiatement.
- Les tokens d'accès sont révoqués côté Inboria.
- Les données dans Inboria restent disponibles ; le CRM n'est pas modifié.

### Plusieurs CRM en parallèle
- Possible de connecter HubSpot + Pipedrive + Salesforce en même temps.
- Chaque email est enrichi des informations issues de tous les CRM connectés.

### Pas de duplication des données
- Inboria stocke uniquement les références minimales (ID, nom, email) pour faire le lien entre emails et CRM.
- Le CRM reste la source unique de vérité.

## QUESTIONS FRÉQUENTES

### Comment connecter ma boîte email ?
Allez dans Paramètres → section Connexions email. Choisissez votre fournisseur (Gmail, Outlook, etc.) et suivez les instructions. Pour Gmail, vous serez redirigé vers Google pour autoriser l'accès. Pour les autres, entrez votre adresse email et votre mot de passe IMAP.

### Pourquoi mes emails ne se synchronisent pas ?
La synchronisation se fait automatiquement toutes les 5 minutes. Si vos emails n'apparaissent pas : vérifiez votre connexion email dans Paramètres, assurez-vous que vos identifiants sont corrects, et que l'accès IMAP est activé dans votre fournisseur email.

### Comment l'IA classe-t-elle mes emails ?
L'IA analyse le sujet, l'expéditeur et le contenu de chaque email pour déterminer sa priorité (Urgent, Moyen, Faible), sa catégorie et générer un résumé. Vous pouvez personnaliser les catégories dans la page Classement.

### Mes données sont-elles sécurisées ?
Oui. Inboria utilise le chiffrement SSL/TLS pour toutes les communications. Vos identifiants email sont stockés de manière sécurisée. Nous ne stockons pas le contenu complet de vos emails de manière permanente — seuls les métadonnées et résumés sont conservés.

### Comment changer de langue ?
Cliquez sur le sélecteur de langue en haut à droite du dashboard (bouton avec le drapeau ou les initiales de la langue). Choisissez entre Français, English ou Nederlands.

### Comment créer un brouillon IA ?
Ouvrez un email, puis cliquez sur l'icône baguette magique (✨). L'IA génère un brouillon de réponse que vous pouvez modifier avant d'envoyer.

### Comment exporter mes tâches ?
Allez dans Tâches, cliquez sur le bouton "Exporter CSV" en haut. Un fichier CSV sera téléchargé avec toutes vos tâches.

### Comment annuler mon abonnement ?
Allez dans Abonnement, vous verrez votre plan actuel. Cliquez sur "Gérer l'abonnement" pour accéder au portail de facturation Paddle où vous pouvez annuler.

### Qu'est-ce qu'un Pack Métier ?
Un Pack Métier est un ensemble de catégories prédéfinies adaptées à votre secteur d'activité. Par exemple, le pack "Comptable" inclut des catégories comme Factures clients, Déclarations fiscales, etc. Allez dans Classement pour les appliquer.

### Comment fonctionnent les crédits IA ?
Chaque plan inclut un nombre mensuel de crédits IA. Un crédit est consommé chaque fois que l'IA traite un email (classement, résumé, brouillon, extraction de tâche). Vous pouvez voir votre consommation dans la barre latérale (jauge en bas). Une fois les crédits épuisés, vous devez passer à un plan supérieur pour continuer.

### Puis-je connecter plusieurs boîtes email ?
Oui, selon votre plan : Starter = 1 boîte, Pro = 3 boîtes, Business = illimité. Ajoutez vos connexions dans Paramètres.

### Comment assigner un email à un collègue ?
Plan Business uniquement : ouvrez l'email et cliquez sur le bouton "Assigner". Choisissez le membre de l'équipe dans la liste.

### Comment utiliser l'agenda ?
L'agenda affiche vos rendez-vous. L'IA détecte automatiquement les RDV mentionnés dans vos emails. Vous pouvez aussi créer des RDV manuellement. Changez de vue (jour/semaine/mois) avec les boutons en haut.`,

    en: `# Inboria — Complete Knowledge Base

## General Overview
Inboria is an AI-powered intelligent email assistant designed for SMEs in Belgium and France. It automatically sorts, categorizes, and summarizes your professional emails. The application works in French, English, and Dutch.

## 1. INBOX
The main page displays all your incoming emails with AI-powered smart sorting.

### Features:
- **Priority sorting**: Each email automatically receives a priority (Urgent 🔴, Medium 🟡, Low 🟢) assigned by AI.
- **AI Summary**: Each email has a short AI-generated summary, visible without opening the email.
- **Automatic categorization**: AI categorizes emails into categories (Invoices, Customer Support, Sales, etc.).
- **Search**: Search bar to find emails by sender, subject, or content.
- **Filters**: Filter by category, priority, status (read/unread, archived).
- **Email actions**: Reply, Archive, Delete, Create task, Create appointment.
- **Bulk selection**: Select multiple emails to archive or delete in bulk.
- **Compose email**: Button to write a new email with AI assistance (AI draft).
- **AI Draft**: AI can generate a reply draft based on the email context. Click the magic wand icon.
- **Attachments**: View and download received attachments. Add attachments when sending.
- **Comments**: Add internal notes on an email (visible only to you and your team).
- **Assign**: Assign an email to a team member (Business plan only).
- **Pagination**: Emails load in batches of 50 for better performance.

### How it works:
1. Connect your email inbox in Settings (Gmail OAuth or IMAP).
2. Inboria syncs your emails automatically every 5 minutes.
3. AI analyzes each email: priority, category, summary.
4. You see your emails smartly sorted in the inbox.

## 2. SENT
Displays all emails you've sent from Inboria.

### Features:
- List of sent emails with recipient, subject, date.
- Search sent emails.
- View full content of a sent email.
- View sent attachments.

## 3. TASKS
AI automatically detects to-do items in your emails and lists them here.

### Features:
- **AI Tasks**: Automatically detected from your emails (e.g., "Please send the quote" → task created).
- **Manual Tasks**: You can also create tasks manually with title and description.
- **Filter**: View all tasks, AI-only tasks, or manual-only tasks.
- **Badges**: Counters for total, AI, and manual tasks.
- **Mark as done**: Check a task to mark it as completed.
- **View source email**: For AI tasks, click to see the original email.
- **Export CSV**: Export all your tasks as a CSV file.

## 4. PROJECTS
Organize your emails by project for thematic tracking.

### Features:
- **Create a project**: Give your project a name and description.
- **Associate emails**: From the inbox, assign an email to a project.
- **Project view**: See all emails associated with a given project.
- **Project status**: Active or archived.

## 5. CALENDAR / AGENDA
Calendar view with automatic AI-powered appointment detection.

### Features:
- **Views**: Day, Week, Month — switch views with buttons at the top.
- **AI Detection**: AI analyzes your emails and automatically detects mentioned appointments.
- **AI Suggestions**: Detected appointments appear as suggestions you can confirm or dismiss.
- **Manual creation**: Create an appointment manually with title, date, time, location, and participants.
- **Today/Tomorrow**: Side panel showing upcoming appointments.
- **Export CSV**: Export your calendar as CSV.
- **View source email**: For AI-detected appointments, access the original email.

## 6. ARCHIVES
Emails you've archived. They're no longer in the inbox but remain accessible.

### Features:
- List of archived emails.
- Search through archives.
- Restore an archived email (put it back in inbox).
- Permanent deletion.
- Trash with "Empty trash" option.

## 7. DAILY BRIEF
AI-generated daily summary of your email activity.

### Features:
- **AI Summary**: Overview of your day's emails (received, urgent, processed).
- **Attention points**: AI identifies important emails requiring your attention.
- **Statistics**: Charts of your email activity.
- **Inbox health**: Health indicator of your inbox (pending emails, average response time).
- **Generate**: Click the button to generate/regenerate today's brief.

## 8. CLASSIFICATION (Categories)
Manage the categories used by AI to classify your emails.

### Features:
- **Default categories**: Invoices, Support, Sales, Admin, Personal, etc.
- **Industry packs**: 50+ industry packs available (Accountant, Lawyer, Restaurant, Real Estate, etc.). Each pack adds categories specific to your industry.
- **AI Pack**: Enter your profession and AI generates customized categories.
- **Create/Edit/Delete**: Manage your categories manually.
- **Keywords**: Each category can have keywords to help AI classify better.
- **Recategorize**: Button to rerun AI categorization on unclassified emails.

## 9. SETTINGS
Account configuration and email connections.

### Sections:
- **Profile**: Edit your name and email signature.
- **Email connections**:
  - Connect Gmail (via OAuth, secure Google authentication).
  - Connect via IMAP: Outlook, Hotmail, Orange, Free, SFR, Yahoo, Proximus, Telenet, iCloud, OVH, IONOS, Infomaniak, and more.
  - View your active connections list.
  - Delete a connection.
- **Notifications**: Enable/disable email notifications.
- **AI Preferences**: Configure AI behavior (summary language, etc.).
- **Language**: Choose interface language (Français, English, Nederlands).
- **Security**: Change your password.

### Supported IMAP providers:
Gmail, Outlook, Hotmail, Orange, Free, SFR, Bouygues, La Poste, Yahoo, Proximus, Skynet, VOO, Telenet, OVH, IONOS, Infomaniak, GMX, iCloud, and "Other" (manual configuration).

## 10. SUBSCRIPTION
Plan and payment management.

### Available plans:
- **Trial**: Free, 100 AI credits included. Perfect for testing.
- **Starter**: €9/month, 500 emails/month, 1 mailbox.
- **Pro**: €19/month, 2000 emails/month, 3 mailboxes. (Recommended)
- **Business**: €39/month per seat, unlimited emails, unlimited mailboxes, shared mailboxes, team management.

### Features:
- View your current plan and usage (AI credits used / total).
- Change plan (upgrade/downgrade).
- Secure payment via Paddle (credit card).
- Cancel subscription.
- Billing history.

## 11. SHARED MAILBOXES (Business plan only)
Shared email inboxes between team members.

### Features:
- Create a shared mailbox (e.g., contact@, info@, support@).
- Assign team members to the mailbox.
- View shared mailbox emails.
- Claim an email (assign it to yourself to handle).
- Release an email (make it available for the team again).

## 12. TEAM MANAGEMENT (Business plan only)
Manage your organization's members.

### Features:
- Invite members by email.
- Set roles: Admin or Member.
- View member list with their status.
- Remove a team member.
- View team activity (emails processed, tasks completed).

## 13. TEAM ACTIVITY (Business plan only)
Track your organization members' activity.

### Features:
- Overview of each member's activity.
- Emails processed per member.
- Tasks completed.

## 14. USER MANUAL
Built-in guide explaining all features.

### Manual sections:
- Quick start
- Email connection
- Inbox and AI sorting
- Calendar (calendar, AI detection, views, CSV export)
- Tasks (AI filter, badges, manual creation, CSV export)
- Sent
- Classification and categories
- Daily brief
- Settings
- Subscription
- Business sections (shared mailboxes, team)

## 15. SPAM AND AI FILTERING
Inboria uses multi-layer filtering to keep noise out of your inbox while saving your AI credits.

### Deterministic pre-filter (before AI):
- **Noreply / notification pattern**: Addresses whose local part matches patterns such as noreply, no-reply, donotreply, notification(s), alerts, mailer-daemon, postmaster, newsletter, bounce, digest, broadcast… are automatically recognized and routed to the "Notifications" category.
- **Sender cache**: The sender_cache table remembers, for every sender we've already seen, their category and priority. The second email from the same sender therefore skips the AI call and inherits the same classification immediately — faster sync and lower credit usage.
- **Deterministic spam detection**: Before any AI step, the pre-filter marks as spam emails that exhibit clear signals (mass commercial senders, known signatures), so they never reach the main Inbox.

### Automatic spam categorization:
- **AI decision**: Emails not covered by the pre-filter pass through GPT-4o-mini, which can decide a message is spam; it's then dropped directly into the Spam folder instead of the Inbox.
- **Dedicated Spam folder**: Accessible from the sidebar, it gathers all emails marked as spam (by the pre-filter or by AI).
- **No credit wasted**: A pre-filtered email consumes zero AI credits — only uncertain messages reach the model.

### Manual reclassification:
- **Restore to Inbox**: From the Spam folder, one click moves a legitimate email back to the main Inbox.
- **Mark as spam**: From the Inbox, you can force an email into Spam if the AI got it wrong.
- **Learning via the cache**: Your restorations and spam markings feed the sender_cache, so the next email from the same sender lands in the right place without hitting the AI again.
- **Empty spam**: Button to permanently delete all spam emails at once, confirmation required.
- **Permanent deletion**: Delete individual spam emails permanently, confirmation required.

### Best practices:
- Check the Spam folder occasionally to rescue false positives and train the cache.
- Restore legitimate emails rather than reopening them: this updates the sender_cache.
- Empty Spam regularly to keep your account light.

## 16. SMART SEND (Wave 1)
Three complementary features to better control your sending and inbox.

### Snooze an email
- **How**: Open an email, click the clock "Snooze" icon and pick a date/time or a preset (Tonight, Tomorrow morning, Next Monday, Custom).
- **Effect**: The email temporarily disappears from your Inbox and automatically reappears at the chosen time as a new unread message.
- **Where to find snoozed emails**: **Snoozed** page in the left menu (under Scheduled). You can "Unsnooze" to bring them back immediately.

### Schedule a send
- **How**: In the composer (new or reply), click the arrow next to the Send button and pick "Send later". Select date and time.
- **Effect**: The email is sent automatically at the planned time. You remain free to cancel or edit it before sending.
- **Where to view scheduled sends**: **Scheduled** page in the left menu.

### Undo Send
- **How**: After clicking Send in a reply, a toast appears at the bottom with an "Undo" button for 10 seconds.
- **Effect**: If you click Undo within 10s, the email is never sent. Otherwise it goes out normally.

### Open tracking
- Indicator on sent emails: "Seen" or "Not seen" depending on whether the recipient opened your email.
- Discreet, privacy-respecting (invisible transparent pixel).

## 17. AI TEMPLATES (Wave 2)
Reusable response template library with AI assistance.

### Create a template
- **Manually**: **Settings → Templates** page, "New template" button. Give a name, subject and body. AI can suggest a name based on the content.
- **From a sent email**: In the composer, after sending, click "Save as template". The content is reused automatically.
- **AI categorization**: Each template gets an automatic tag (quote, follow-up, meeting, refusal, thanks, follow-up, other).

### Use a template
- **Auto suggestions**: When you open a reply, a banner at the top of the composer displays 1 to 3 relevant templates for the received email's context.
- **One-click insertion**: Click a suggestion to insert the template into the reply.
- **Variables**: If the template contains variables (e.g. {{firstname}}), they are filled in automatically when possible.

### Manage templates
- **Settings → Templates** page: list grouped by category, search, edit, delete.
- Usage counter: see how many times each template has been used.

## 18. AUTOMATION RULES (Wave 2)
Automate handling of certain emails in natural language.

### Create a rule
- **Page**: **Settings → Rules**, "New rule" button.
- **In natural language**: Type for example "If a customer mentions quote, classify as Sales and notify me". AI translates the sentence into a structured rule (conditions + actions).
- **Possible conditions**: Sender contains X, Subject contains X, Body contains X, AI Category = X, Priority = X.
- **Possible actions**: Classify in a category, Mark as priority, Notify, Archive, Assign to a member, Create a task.

### Test before activating (Simulator)
- **"Simulate" button**: Before activating a rule, run the simulator. It shows you which emails from the last 30 days would have been affected.
- **Safety**: Avoids surprises. If the rule catches too many emails, adjust the conditions.

### Tracking and rollback
- **Counter**: Each rule displays the number of times it has been triggered.
- **Audit log**: List of all actions executed by rules in the last 24 hours.
- **One-click undo**: For each action in the last 24h, "Undo" button which restores the previous state (e.g. original category, unarchived status).

### Enable/Disable
- Switch on each rule to pause it without deleting it.

## 19. CRM INTEGRATIONS

Inboria natively connects to 4 leading CRMs: HubSpot, Pipedrive, Salesforce and Odoo. Sync is bidirectional and automatic.

### Supported CRMs
- **HubSpot**: contacts and deals sync.
- **Pipedrive**: persons, deals and organizations sync.
- **Salesforce**: contacts, accounts and opportunities sync. Sandbox mode available (toggle at connection time pointing to test.salesforce.com) to test before going to Production.
- **Odoo**: contacts (res.partner) and opportunities (crm.lead) sync. Authentication by instance URL + database + login + API key (generated in Odoo: Profile → Account Security → New API Key). No OAuth — Odoo doesn't expose standard OAuth.

### How to connect a CRM
1. Go to Settings → CRM.
2. Click "Connect" next to your chosen CRM.
3. You're redirected to the CRM's official OAuth login page.
4. You authorize Inboria to access your contacts and deals.
5. An initial sync runs automatically.

### Automatic sync
- **HubSpot and Pipedrive**: automatic sync every 15 minutes in the background (\`crm-sync-scheduler\`).
- **Salesforce**: initial sync at connection time + manual "Sync now" button available any time in Settings → CRM.
- **Bidirectional**: CRM-side changes flow into Inboria, and new contacts in Inboria can be created in the CRM.
- **Manual sync for all CRMs**: "Sync now" button in Settings → CRM. Shows the number of contacts and deals synced.
- **Last-sync date**: visible on each connected CRM's card.

### What the user sees in Inboria
- When an email arrives, Inboria automatically identifies the matching contact in the connected CRM.
- Open deals/opportunities with this contact are visible from the email.
- New information from a conversation can enrich the CRM.

### OAuth security
- **No password stored**: Inboria uses OAuth exclusively.
- **Tokens encrypted at rest** in the database.
- **Revocation any time**: from the CRM (Connected Apps page) or from Settings → CRM in Inboria.
- **TLS-encrypted** end-to-end exchanges.

### Salesforce specifics
- Sandbox toggle to target test.salesforce.com (recommended for mid-market/enterprise: test on a Sandbox org before connecting Production).
- Lightning Experience compatible.
- The \`workspaceName\` badge shows "(Sandbox)" when connected to Sandbox.

### Disconnection
- "Disconnect" button in Settings → CRM.
- Sync stops immediately.
- Access tokens are revoked on Inboria's side.
- Data inside Inboria stays available; the CRM is not modified.

### Multiple CRMs in parallel
- You can connect HubSpot + Pipedrive + Salesforce at the same time.
- Each email is enriched with information from every connected CRM.

### No data duplication
- Inboria only stores minimal references (ID, name, email) to link emails with the CRM.
- The CRM remains the single source of truth.

## FREQUENTLY ASKED QUESTIONS

### How do I connect my email?
Go to Settings → Email Connections section. Choose your provider (Gmail, Outlook, etc.) and follow the instructions. For Gmail, you'll be redirected to Google to authorize access. For others, enter your email address and IMAP password.

### Why aren't my emails syncing?
Sync happens automatically every 5 minutes. If your emails don't appear: check your email connection in Settings, make sure your credentials are correct, and that IMAP access is enabled in your email provider.

### How does AI classify my emails?
AI analyzes the subject, sender, and content of each email to determine its priority (Urgent, Medium, Low), category, and generate a summary. You can customize categories in the Classification page.

### Is my data secure?
Yes. Inboria uses SSL/TLS encryption for all communications. Your email credentials are stored securely. We don't permanently store the full content of your emails — only metadata and summaries are kept.

### How do I change the language?
Click the language selector at the top right of the dashboard (button with the flag or language initials). Choose between Français, English, or Nederlands.

### How do I create an AI draft?
Open an email, then click the magic wand icon (✨). AI generates a reply draft that you can edit before sending.

### How do I export my tasks?
Go to Tasks, click the "Export CSV" button at the top. A CSV file will be downloaded with all your tasks.

### How do I cancel my subscription?
Go to Subscription, you'll see your current plan. Click "Manage subscription" to access the Paddle billing portal where you can cancel.

### What is an Industry Pack?
An Industry Pack is a set of predefined categories tailored to your industry. For example, the "Accountant" pack includes categories like Client Invoices, Tax Returns, etc. Go to Classification to apply them.

### How do AI credits work?
Each plan includes a monthly amount of AI credits. One credit is consumed every time the AI processes an email (sorting, summary, draft, task extraction). You can see your usage in the sidebar (gauge at the bottom). Once your credits are used up, you need to upgrade to a higher plan to continue.

### Can I connect multiple email accounts?
Yes, depending on your plan: Starter = 1 mailbox, Pro = 3 mailboxes, Business = unlimited. Add connections in Settings.

### How do I assign an email to a colleague?
Business plan only: open the email and click the "Assign" button. Choose the team member from the list.

### How do I use the calendar?
The calendar displays your appointments. AI automatically detects appointments mentioned in your emails. You can also create appointments manually. Switch views (day/week/month) with the buttons at the top.`,

    nl: `# Inboria — Volledige Kennisbank

## Algemeen Overzicht
Inboria is een AI-aangedreven intelligente e-mailassistent ontworpen voor KMO's in België en Frankrijk. Het sorteert, classificeert en vat uw professionele e-mails automatisch samen. De applicatie werkt in het Frans, Engels en Nederlands.

## 1. ONTVANGEN (Inbox)
De hoofdpagina toont al uw inkomende e-mails met slimme AI-sortering.

### Functies:
- **Prioriteitssortering**: Elke e-mail krijgt automatisch een prioriteit (Dringend 🔴, Gemiddeld 🟡, Laag 🟢) toegewezen door AI.
- **AI-samenvatting**: Elke e-mail heeft een korte AI-gegenereerde samenvatting, zichtbaar zonder de e-mail te openen.
- **Automatische categorisering**: AI classificeert e-mails in categorieën (Facturen, Klantenservice, Commercieel, enz.).
- **Zoeken**: Zoekbalk om e-mails te vinden op afzender, onderwerp of inhoud.
- **Filters**: Filteren op categorie, prioriteit, status (gelezen/ongelezen, gearchiveerd).
- **E-mailacties**: Beantwoorden, Archiveren, Verwijderen, Taak aanmaken, Afspraak aanmaken.
- **Meervoudige selectie**: Selecteer meerdere e-mails om in bulk te archiveren of verwijderen.
- **E-mail opstellen**: Knop om een nieuwe e-mail te schrijven met AI-hulp (AI-concept).
- **AI-concept**: AI kan een antwoordconcept genereren op basis van de e-mailcontext. Klik op het toverstaficoon.
- **Bijlagen**: Bekijk en download ontvangen bijlagen. Voeg bijlagen toe bij het verzenden.
- **Opmerkingen**: Voeg interne notities toe aan een e-mail (alleen zichtbaar voor u en uw team).
- **Toewijzen**: Wijs een e-mail toe aan een teamlid (alleen Business-plan).
- **Paginering**: E-mails laden in batches van 50 voor betere prestaties.

### Hoe het werkt:
1. Verbind uw e-mailbox in Instellingen (Gmail OAuth of IMAP).
2. Inboria synchroniseert uw e-mails automatisch elke 5 minuten.
3. AI analyseert elke e-mail: prioriteit, categorie, samenvatting.
4. U ziet uw e-mails slim gesorteerd in de inbox.

## 2. VERZONDEN
Toont alle e-mails die u vanuit Inboria heeft verzonden.

### Functies:
- Lijst van verzonden e-mails met ontvanger, onderwerp, datum.
- Zoeken in verzonden e-mails.
- Volledige inhoud van een verzonden e-mail bekijken.
- Verzonden bijlagen bekijken.

## 3. TAKEN
AI detecteert automatisch to-do items in uw e-mails en somt ze hier op.

### Functies:
- **AI-taken**: Automatisch gedetecteerd uit uw e-mails (bijv. "Stuur de offerte" → taak aangemaakt).
- **Handmatige taken**: U kunt ook handmatig taken aanmaken met titel en beschrijving.
- **Filteren**: Bekijk alle taken, alleen AI-taken of alleen handmatige taken.
- **Badges**: Tellers voor totaal, AI en handmatige taken.
- **Markeren als gedaan**: Vink een taak af om deze als voltooid te markeren.
- **Bron-e-mail bekijken**: Voor AI-taken, klik om de originele e-mail te zien.
- **CSV exporteren**: Exporteer al uw taken als CSV-bestand.

## 4. PROJECTEN
Organiseer uw e-mails per project voor thematische opvolging.

### Functies:
- **Project aanmaken**: Geef uw project een naam en beschrijving.
- **E-mails koppelen**: Vanuit de inbox, wijs een e-mail toe aan een project.
- **Projectweergave**: Bekijk alle e-mails die aan een project zijn gekoppeld.
- **Projectstatus**: Actief of gearchiveerd.

## 5. AGENDA / KALENDER
Kalenderweergave met automatische AI-detectie van afspraken.

### Functies:
- **Weergaven**: Dag, Week, Maand — wissel van weergave met de knoppen bovenaan.
- **AI-detectie**: AI analyseert uw e-mails en detecteert automatisch vermelde afspraken.
- **AI-suggesties**: Gedetecteerde afspraken verschijnen als suggesties die u kunt bevestigen of negeren.
- **Handmatig aanmaken**: Maak een afspraak handmatig aan met titel, datum, tijd, locatie en deelnemers.
- **Vandaag/Morgen**: Zijpaneel met komende afspraken.
- **CSV exporteren**: Exporteer uw agenda als CSV.
- **Bron-e-mail bekijken**: Voor AI-gedetecteerde afspraken, toegang tot de originele e-mail.

## 6. ARCHIEF
E-mails die u heeft gearchiveerd. Ze staan niet meer in de inbox maar blijven toegankelijk.

### Functies:
- Lijst van gearchiveerde e-mails.
- Zoeken in het archief.
- Een gearchiveerde e-mail herstellen (terug in de inbox plaatsen).
- Definitief verwijderen.
- Prullenbak met optie "Prullenbak legen".

## 7. DAGELIJKS OVERZICHT
AI-gegenereerd dagelijks overzicht van uw e-mailactiviteit.

### Functies:
- **AI-samenvatting**: Overzicht van uw e-mails van de dag (ontvangen, urgent, verwerkt).
- **Aandachtspunten**: AI identificeert belangrijke e-mails die uw aandacht vereisen.
- **Statistieken**: Grafieken van uw e-mailactiviteit.
- **Inbox-gezondheid**: Gezondheidsindicator van uw inbox (wachtende e-mails, gemiddelde reactietijd).
- **Genereren**: Klik op de knop om het overzicht van vandaag te genereren/opnieuw te genereren.

## 8. CLASSIFICATIE (Categorieën)
Beheer de categorieën die door AI worden gebruikt om uw e-mails te classificeren.

### Functies:
- **Standaardcategorieën**: Facturen, Support, Commercieel, Admin, Persoonlijk, enz.
- **Branchepakketten**: 50+ branchepakketten beschikbaar (Accountant, Advocaat, Restaurant, Vastgoed, enz.). Elk pakket voegt categorieën toe die specifiek zijn voor uw sector.
- **AI-pakket**: Voer uw beroep in en AI genereert aangepaste categorieën.
- **Aanmaken/Bewerken/Verwijderen**: Beheer uw categorieën handmatig.
- **Trefwoorden**: Elke categorie kan trefwoorden hebben om AI te helpen beter te classificeren.
- **Herclassificeren**: Knop om AI-classificatie opnieuw uit te voeren op niet-geclassificeerde e-mails.

## 9. INSTELLINGEN
Accountconfiguratie en e-mailverbindingen.

### Secties:
- **Profiel**: Bewerk uw naam en e-mailhandtekening.
- **E-mailverbindingen**:
  - Gmail verbinden (via OAuth, veilige Google-authenticatie).
  - Verbinden via IMAP: Outlook, Hotmail, Orange, Free, SFR, Yahoo, Proximus, Telenet, iCloud, OVH, IONOS, Infomaniak, en meer.
  - Uw actieve verbindingen bekijken.
  - Een verbinding verwijderen.
- **Meldingen**: Meldingen in-/uitschakelen.
- **AI-voorkeuren**: AI-gedrag configureren (samenvattingstaal, enz.).
- **Taal**: Interfacetaal kiezen (Français, English, Nederlands).
- **Beveiliging**: Wachtwoord wijzigen.

### Ondersteunde IMAP-providers:
Gmail, Outlook, Hotmail, Orange, Free, SFR, Bouygues, La Poste, Yahoo, Proximus, Skynet, VOO, Telenet, OVH, IONOS, Infomaniak, GMX, iCloud, en "Andere" (handmatige configuratie).

## 10. ABONNEMENT
Plan- en betalingsbeheer.

### Beschikbare plannen:
- **Proefperiode**: Gratis, 100 AI-e-mails inbegrepen. Perfect om te testen.
- **Starter**: €9/maand, 500 e-mails/maand, 1 mailbox.
- **Pro**: €19/maand, 2000 e-mails/maand, 3 mailboxen. (Aanbevolen)
- **Business**: €39/maand per zetel, onbeperkte e-mails, onbeperkte mailboxen, gedeelde mailboxen, teambeheer.

### Functies:
- Uw huidige plan en gebruik bekijken (gebruikte e-mails / quotum).
- Plan wijzigen (upgraden/downgraden).
- Veilige betaling via Paddle (creditcard).
- Abonnement opzeggen.
- Factureringsgeschiedenis.

## 11. GEDEELDE MAILBOXEN (alleen Business-plan)
Gedeelde e-mailinboxen tussen teamleden.

### Functies:
- Een gedeelde mailbox aanmaken (bijv. contact@, info@, support@).
- Teamleden aan de mailbox toewijzen.
- E-mails van de gedeelde mailbox bekijken.
- Een e-mail claimen (aan uzelf toewijzen om af te handelen).
- Een e-mail vrijgeven (weer beschikbaar maken voor het team).

## 12. TEAMBEHEER (alleen Business-plan)
Beheer de leden van uw organisatie.

### Functies:
- Leden uitnodigen per e-mail.
- Rollen instellen: Admin of Lid.
- Ledenlijst met hun status bekijken.
- Een teamlid verwijderen.
- Teamactiviteit bekijken (verwerkte e-mails, voltooide taken).

## 13. TEAMACTIVITEIT (alleen Business-plan)
Volg de activiteit van uw organisatieleden.

### Functies:
- Overzicht van de activiteit van elk lid.
- Verwerkte e-mails per lid.
- Voltooide taken.

## 14. GEBRUIKERSHANDLEIDING
Ingebouwde gids die alle functies uitlegt.

### Handboeksecties:
- Snelstart
- E-mailverbinding
- Inbox en AI-sortering
- Agenda (kalender, AI-detectie, weergaven, CSV-export)
- Taken (AI-filter, badges, handmatig aanmaken, CSV-export)
- Verzonden
- Classificatie en categorieën
- Dagelijks overzicht
- Instellingen
- Abonnement
- Business-secties (gedeelde mailboxen, team)

## 15. SPAM EN AI-FILTERING
Inboria gebruikt meerlaags filteren om ruis uit uw inbox te houden en tegelijk uw AI-credits te besparen.

### Deterministische voorfilter (vóór AI):
- **Noreply / notificatie-patroon**: Adressen waarvan het lokale deel overeenkomt met patronen zoals noreply, no-reply, donotreply, notification(s), alerts, mailer-daemon, postmaster, newsletter, bounce, digest, broadcast… worden automatisch herkend en in de categorie "Notificaties" geplaatst.
- **Verzendercache**: De tabel sender_cache onthoudt voor elke reeds geziene afzender de categorie en prioriteit. De tweede e-mail van dezelfde afzender slaat de AI-aanroep dus over en erft direct dezelfde classificatie — snellere synchronisatie, lager creditgebruik.
- **Deterministische spamdetectie**: Vóór elke AI-stap markeert de voorfilter e-mails als spam die duidelijke signalen vertonen (massale commerciële afzenders, bekende handtekeningen), zodat ze nooit in de hoofdinbox belanden.

### Automatische spamcategorisering:
- **AI-beslissing**: E-mails die niet door de voorfilter worden afgevangen, gaan door GPT-4o-mini, dat kan beslissen dat een bericht spam is; het komt dan rechtstreeks in de Spam-map terecht in plaats van de Inbox.
- **Aparte Spam-map**: Toegankelijk vanuit de zijbalk, verzamelt alle als spam gemarkeerde e-mails (door de voorfilter of de AI).
- **Geen verspilde credits**: Een voorgefilterde e-mail verbruikt nul AI-credits — alleen onzekere berichten bereiken het model.

### Handmatige herclassificatie:
- **Herstellen naar Inbox**: Vanuit de Spam-map verplaatst één klik een legitieme e-mail terug naar de hoofdinbox.
- **Markeren als spam**: Vanuit de Inbox kunt u een e-mail naar Spam forceren als de AI het verkeerd had.
- **Leren via de cache**: Uw herstellingen en spam-markeringen voeden de sender_cache, zodat de volgende e-mail van dezelfde afzender op de juiste plek belandt zonder de AI opnieuw aan te roepen.
- **Spam legen**: Knop om alle spam-e-mails in één keer definitief te verwijderen, bevestiging vereist.
- **Permanent verwijderen**: Verwijder individuele spam-e-mails definitief, bevestiging vereist.

### Best practices:
- Controleer de Spam-map af en toe om vals-positieven te redden en de cache te trainen.
- Herstel legitieme e-mails in plaats van ze opnieuw te openen: dit werkt de sender_cache bij.
- Leeg Spam regelmatig om uw account licht te houden.

## 16. SLIM VERZENDEN (Golf 1)
Drie aanvullende functies om uw verzendingen en inbox beter te beheersen.

### Een e-mail uitstellen (Snooze)
- **Hoe**: Open een e-mail, klik op het klokpictogram "Uitstellen" en kies datum/tijd of een snelkeuze (Vanavond, Morgenochtend, Volgende maandag, Aangepast).
- **Effect**: De e-mail verdwijnt tijdelijk uit de Inbox en verschijnt automatisch op het gekozen tijdstip als nieuw ongelezen bericht.
- **Uitgestelde e-mails terugvinden**: Pagina **Uitgesteld** in het linker menu (onder Gepland). U kunt "Niet meer uitstellen" om ze meteen terug te halen.

### Verzending plannen
- **Hoe**: In de composer (nieuw of beantwoorden), klik op de pijl naast Verzenden en kies "Later verzenden". Selecteer datum en tijd.
- **Effect**: De e-mail wordt automatisch verzonden op de geplande tijd. U kunt nog annuleren of aanpassen vóór verzending.
- **Geplande verzendingen bekijken**: Pagina **Gepland** in het linker menu.

### Verzenden ongedaan maken (Undo Send)
- **Hoe**: Na het klikken op Verzenden in een antwoord verschijnt onderaan een melding met een "Ongedaan maken"-knop gedurende 10 seconden.
- **Effect**: Klikt u binnen 10s op Ongedaan maken, dan wordt de e-mail nooit verzonden. Anders gaat hij normaal weg.

### Openings-tracking
- Indicator op verzonden e-mails: "Gezien" of "Niet gezien" afhankelijk of de ontvanger uw e-mail heeft geopend.
- Discreet, met respect voor privacy (onzichtbare transparante pixel).

## 17. AI-SJABLONEN (Golf 2)
Herbruikbare antwoordsjablonen met AI-ondersteuning.

### Een sjabloon maken
- **Handmatig**: Pagina **Instellingen → Sjablonen**, knop "Nieuw sjabloon". Geef een naam, onderwerp en inhoud. AI kan een naam voorstellen op basis van de inhoud.
- **Vanuit een verzonden e-mail**: Klik in de composer na verzenden op "Opslaan als sjabloon". De inhoud wordt automatisch overgenomen.
- **AI-categorisatie**: Elk sjabloon krijgt een automatisch label (offerte, opvolging, afspraak, weigering, dank, opvolging, overig).

### Een sjabloon gebruiken
- **Automatische suggesties**: Bij het openen van een antwoord toont een balk bovenaan de composer 1 tot 3 relevante sjablonen voor de context van de ontvangen e-mail.
- **Invoegen met één klik**: Klik op een suggestie om het sjabloon in te voegen.
- **Variabelen**: Bevat het sjabloon variabelen (bv. {{voornaam}}), dan worden die waar mogelijk automatisch ingevuld.

### Sjablonen beheren
- Pagina **Instellingen → Sjablonen**: lijst gegroepeerd per categorie, zoeken, bewerken, verwijderen.
- Gebruiks-teller: zie hoe vaak elk sjabloon is gebruikt.

## 18. AUTOMATISERINGSREGELS (Golf 2)
Automatiseer de behandeling van bepaalde e-mails in natuurlijke taal.

### Een regel maken
- **Pagina**: **Instellingen → Regels**, knop "Nieuwe regel".
- **In natuurlijke taal**: Typ bijvoorbeeld "Als een klant offerte vermeldt, classificeer als Commercieel en stuur een melding". AI vertaalt de zin in een gestructureerde regel (voorwaarden + acties).
- **Mogelijke voorwaarden**: Afzender bevat X, Onderwerp bevat X, Inhoud bevat X, AI-categorie = X, Prioriteit = X.
- **Mogelijke acties**: Classificeren in een categorie, Markeren als prioriteit, Melding sturen, Archiveren, Toewijzen aan lid, Taak aanmaken.

### Testen vóór activeren (Simulator)
- **Knop "Simuleren"**: Vóór het activeren van een regel, voer de simulator uit. Hij toont welke e-mails van de afgelopen 30 dagen zouden zijn beïnvloed.
- **Veiligheid**: Voorkomt verrassingen. Vangt de regel te veel e-mails, pas dan de voorwaarden aan.

### Opvolging en rollback
- **Teller**: Elke regel toont het aantal keer dat hij is geactiveerd.
- **Auditlogboek**: Lijst van alle acties uitgevoerd door regels in de afgelopen 24 uur.
- **Één klik om ongedaan te maken**: Voor elke actie van de laatste 24u, knop "Ongedaan maken" die de vorige staat herstelt (bv. originele categorie, niet-gearchiveerde status).

### Aan/Uit
- Schakelaar op elke regel om hem te pauzeren zonder te verwijderen.

## 19. CRM-INTEGRATIES

Inboria maakt een native verbinding met 4 toonaangevende CRM's: HubSpot, Pipedrive, Salesforce en Odoo. De synchronisatie is bidirectioneel en automatisch.

### Ondersteunde CRM's
- **HubSpot**: synchronisatie van contacten en deals.
- **Pipedrive**: synchronisatie van personen, deals en organisaties.
- **Salesforce**: synchronisatie van contacten, accounts en opportunities. Sandbox-modus beschikbaar (toggle bij verbinding naar test.salesforce.com) om te testen vóór Productie.
- **Odoo**: synchronisatie van contacten (res.partner) en kansen (crm.lead). Authenticatie via instance-URL + database + login + API-sleutel (gegenereerd in Odoo: Profiel → Accountbeveiliging → Nieuwe API-sleutel). Geen OAuth — Odoo biedt geen standaard OAuth.

### Een CRM verbinden
1. Ga naar Instellingen → CRM.
2. Klik op "Verbinden" naast het gewenste CRM.
3. U wordt doorgestuurd naar de officiële OAuth-loginpagina van het CRM.
4. U geeft Inboria toestemming om uw contacten en deals te benaderen.
5. Een initiële synchronisatie verloopt automatisch.

### Automatische synchronisatie
- **HubSpot en Pipedrive**: automatische synchronisatie elke 15 minuten op de achtergrond (planner \`crm-sync-scheduler\`).
- **Salesforce**: initiële synchronisatie bij verbinding + handmatige knop "Nu synchroniseren" altijd beschikbaar in Instellingen → CRM.
- **Bidirectioneel**: wijzigingen in het CRM komen in Inboria terecht en nieuwe contacten in Inboria kunnen in het CRM worden aangemaakt.
- **Handmatige sync voor alle CRM's**: knop "Nu synchroniseren" in Instellingen → CRM. Toont het aantal gesynchroniseerde contacten en deals.
- **Datum laatste sync**: zichtbaar op de kaart van elk verbonden CRM.

### Wat de gebruiker ziet in Inboria
- Wanneer een e-mail binnenkomt, identificeert Inboria automatisch het overeenkomstige contact in het verbonden CRM.
- Lopende deals/opportunities met dit contact zijn zichtbaar vanuit de e-mail.
- Nieuwe info uit een gesprek kan het CRM verrijken.

### OAuth-beveiliging
- **Geen wachtwoord opgeslagen**: Inboria gebruikt uitsluitend OAuth.
- **Tokens versleuteld in rust** in de database.
- **Te allen tijde intrekbaar**: vanuit het CRM (pagina Verbonden apps) of vanuit Instellingen → CRM in Inboria.
- **TLS-versleutelde** end-to-end uitwisselingen.

### Salesforce-specificiteiten
- Sandbox-toggle voor test.salesforce.com (aanbevolen voor middenbedrijf/grote organisaties: eerst testen op een Sandbox-org).
- Compatibel met Lightning Experience.
- De \`workspaceName\`-badge toont "(Sandbox)" bij een Sandbox-verbinding.

### Verbinding verbreken
- Knop "Verbinden verbreken" in Instellingen → CRM.
- Synchronisatie stopt onmiddellijk.
- Toegangstokens worden ingetrokken aan Inboria's kant.
- Gegevens binnen Inboria blijven beschikbaar; het CRM wordt niet gewijzigd.

### Meerdere CRM's parallel
- HubSpot + Pipedrive + Salesforce kunnen tegelijk verbonden zijn.
- Elke e-mail wordt verrijkt met informatie uit alle verbonden CRM's.

### Geen gegevensduplicatie
- Inboria slaat alleen minimale referenties op (ID, naam, e-mail) om e-mails aan het CRM te koppelen.
- Het CRM blijft de enige bron van waarheid.

## VEELGESTELDE VRAGEN

### Hoe verbind ik mijn e-mail?
Ga naar Instellingen → E-mailverbindingen. Kies uw provider (Gmail, Outlook, enz.) en volg de instructies. Voor Gmail wordt u doorgestuurd naar Google om toegang te autoriseren. Voor andere providers voert u uw e-mailadres en IMAP-wachtwoord in.

### Waarom synchroniseren mijn e-mails niet?
Synchronisatie gebeurt automatisch elke 5 minuten. Als uw e-mails niet verschijnen: controleer uw e-mailverbinding in Instellingen, zorg ervoor dat uw gegevens correct zijn en dat IMAP-toegang is ingeschakeld bij uw e-mailprovider.

### Hoe classificeert AI mijn e-mails?
AI analyseert het onderwerp, de afzender en de inhoud van elke e-mail om de prioriteit (Dringend, Gemiddeld, Laag), categorie te bepalen en een samenvatting te genereren. U kunt categorieën aanpassen op de Classificatiepagina.

### Zijn mijn gegevens veilig?
Ja. Inboria gebruikt SSL/TLS-versleuteling voor alle communicatie. Uw e-mailgegevens worden veilig opgeslagen. We slaan de volledige inhoud van uw e-mails niet permanent op — alleen metadata en samenvattingen worden bewaard.

### Hoe verander ik de taal?
Klik op de taalkiezer rechtsboven in het dashboard (knop met de vlag of taalinitialen). Kies tussen Français, English of Nederlands.

### Hoe maak ik een AI-concept?
Open een e-mail en klik op het toverstaficoon (✨). AI genereert een antwoordconcept dat u kunt bewerken voordat u het verstuurt.

### Hoe exporteer ik mijn taken?
Ga naar Taken, klik op de knop "CSV exporteren" bovenaan. Er wordt een CSV-bestand gedownload met al uw taken.

### Hoe annuleer ik mijn abonnement?
Ga naar Abonnement, u ziet uw huidige plan. Klik op "Abonnement beheren" om het Paddle-factureringsportaal te openen waar u kunt opzeggen.

### Wat is een Branchepakket?
Een Branchepakket is een set voorgedefinieerde categorieën afgestemd op uw branche. Bijvoorbeeld, het pakket "Accountant" bevat categorieën zoals Klantfacturen, Belastingaangiften, enz. Ga naar Classificatie om ze toe te passen.

### Hoe werkt het e-mailquotum?
Elk plan heeft een maandelijks quotum aan e-mails dat AI kan verwerken. U kunt uw gebruik zien in de zijbalk (meter onderaan). Zodra het quotum is bereikt, moet u upgraden naar een hoger plan om door te gaan.

### Kan ik meerdere e-mailaccounts verbinden?
Ja, afhankelijk van uw plan: Starter = 1 mailbox, Pro = 3 mailboxen, Business = onbeperkt. Voeg verbindingen toe in Instellingen.

### Hoe wijs ik een e-mail toe aan een collega?
Alleen Business-plan: open de e-mail en klik op de knop "Toewijzen". Kies het teamlid uit de lijst.

### Hoe gebruik ik de agenda?
De agenda toont uw afspraken. AI detecteert automatisch afspraken die in uw e-mails worden vermeld. U kunt ook handmatig afspraken aanmaken. Wissel van weergave (dag/week/maand) met de knoppen bovenaan.`,

    de: `# Inboria — Vollständige Wissensdatenbank

## Allgemeine Übersicht
Inboria ist ein KI-gestützter intelligenter E-Mail-Assistent für KMU in Belgien und Frankreich. Er sortiert, klassifiziert und fasst Ihre geschäftlichen E-Mails automatisch zusammen. Die Anwendung ist auf Französisch, Englisch, Niederländisch, Deutsch und Spanisch verfügbar.

## 1. POSTEINGANG
Die Hauptseite zeigt alle eingehenden E-Mails mit intelligenter KI-Sortierung.

### Funktionen:
- **Prioritätssortierung**: Jede E-Mail erhält automatisch eine Priorität (Dringend 🔴, Mittel 🟡, Niedrig 🟢) durch die KI.
- **KI-Zusammenfassung**: Jede E-Mail hat eine kurze KI-Zusammenfassung, die ohne Öffnen sichtbar ist.
- **Automatische Kategorisierung**: Die KI ordnet E-Mails Kategorien zu (Rechnungen, Kundensupport, Vertrieb usw.).
- **Suche**: Suchleiste, um E-Mails nach Absender, Betreff oder Inhalt zu finden.
- **Filter**: Nach Kategorie, Priorität, Status (gelesen/ungelesen, archiviert) filtern.
- **Aktionen**: Antworten, Archivieren, Löschen, Aufgabe erstellen, Termin erstellen.
- **Mehrfachauswahl**: Mehrere E-Mails auswählen, um sie gemeinsam zu archivieren oder zu löschen.
- **E-Mail verfassen**: Schaltfläche zum Verfassen einer neuen E-Mail mit KI-Unterstützung.
- **KI-Entwurf**: Die KI kann einen Antwortentwurf basierend auf dem Kontext der E-Mail erstellen. Klicken Sie auf das Zauberstab-Symbol.
- **Anhänge**: Empfangene Anhänge anzeigen und herunterladen. Anhänge beim Senden hinzufügen.
- **Kommentare**: Interne Notizen zu einer E-Mail hinzufügen (nur für Sie und Ihr Team sichtbar).
- **Zuweisen**: Eine E-Mail einem Teammitglied zuweisen (nur Business-Tarif).
- **Paginierung**: E-Mails werden in Stapeln von 50 für bessere Leistung geladen.

### Funktionsweise:
1. Verbinden Sie Ihr E-Mail-Konto in Einstellungen (Gmail OAuth oder IMAP).
2. Inboria synchronisiert Ihre E-Mails automatisch alle 5 Minuten.
3. Die KI analysiert jede E-Mail: Priorität, Kategorie, Zusammenfassung.
4. Sie sehen Ihre E-Mails intelligent sortiert im Posteingang.

## 2. GESENDET
Zeigt alle E-Mails an, die Sie aus Inboria gesendet haben.

### Funktionen:
- Liste der gesendeten E-Mails mit Empfänger, Betreff, Datum.
- Suche in gesendeten E-Mails.
- Vollständigen Inhalt einer gesendeten E-Mail anzeigen.
- Gesendete Anhänge anzeigen.

## 3. AUFGABEN
Die KI erkennt automatisch Aufgaben in Ihren E-Mails und listet sie hier auf.

### Funktionen:
- **KI-Aufgaben**: Automatisch in Ihren E-Mails erkannt (z. B. "Bitte senden Sie das Angebot" → Aufgabe erstellt).
- **Manuelle Aufgaben**: Sie können auch Aufgaben mit Titel und Beschreibung manuell erstellen.
- **Filtern**: Alle Aufgaben anzeigen, nur KI-Aufgaben oder nur manuelle.
- **Abzeichen**: Zähler für gesamt, KI und manuell.
- **Als erledigt markieren**: Häkchen setzen, um eine Aufgabe als erledigt zu markieren.
- **Quell-E-Mail anzeigen**: Bei KI-Aufgaben klicken, um die ursprüngliche E-Mail zu sehen.
- **CSV exportieren**: Alle Aufgaben als CSV-Datei exportieren.

## 4. PROJEKTE
Organisieren Sie Ihre E-Mails nach Projekt für eine thematische Nachverfolgung.

### Funktionen:
- **Projekt erstellen**: Geben Sie Ihrem Projekt einen Namen und eine Beschreibung.
- **E-Mails zuordnen**: Aus dem Posteingang einer E-Mail ein Projekt zuweisen.
- **Projektansicht**: Alle einem Projekt zugeordneten E-Mails anzeigen.
- **Projektstatus**: Aktiv oder archiviert.

## 5. KALENDER
Kalenderansicht mit automatischer Terminerkennung durch die KI.

### Funktionen:
- **Ansichten**: Tag, Woche, Monat — Ansicht mit den Schaltflächen oben wechseln.
- **KI-Erkennung**: Die KI analysiert Ihre E-Mails und erkennt automatisch erwähnte Termine.
- **KI-Vorschläge**: Erkannte Termine erscheinen als Vorschläge, die Sie bestätigen oder ignorieren können.
- **Manuell erstellen**: Termin manuell mit Titel, Datum, Uhrzeit, Ort und Teilnehmern erstellen.
- **Heutige/Morgige Termine**: Seitenleiste mit den nächsten Terminen.
- **CSV exportieren**: Kalender als CSV exportieren.
- **Quell-E-Mail anzeigen**: Bei KI-erkannten Terminen die ursprüngliche E-Mail aufrufen.

## 6. ARCHIV
E-Mails, die Sie archiviert haben. Sie sind nicht mehr im Posteingang, bleiben aber zugänglich.

### Funktionen:
- Liste archivierter E-Mails.
- Suche im Archiv.
- Archivierte E-Mail wiederherstellen (in Posteingang zurücklegen).
- Endgültig löschen.
- Papierkorb mit Option "Papierkorb leeren".

## 7. TAGESBERICHT
Tägliche von KI generierte Zusammenfassung Ihrer E-Mail-Aktivität.

### Funktionen:
- **KI-Zusammenfassung**: Übersicht über Ihre heutigen E-Mails (empfangen, dringend, bearbeitet).
- **Achtungspunkte**: Die KI identifiziert wichtige E-Mails, die Aufmerksamkeit erfordern.
- **Statistiken**: Diagramme Ihrer E-Mail-Aktivität.
- **Posteingangsgesundheit**: Indikator für die Gesundheit Ihres Postfachs (ausstehend, durchschnittliche Antwortzeit).
- **Generieren**: Klicken Sie auf die Schaltfläche, um den Tagesbericht zu generieren/regenerieren.

## 8. KLASSIFIZIERUNG (Kategorien)
Verwalten Sie die Kategorien, die die KI zur Klassifizierung verwendet.

### Funktionen:
- **Standardkategorien**: Rechnungen, Support, Vertrieb, Verwaltung, Privat usw.
- **Branchenpakete**: Über 50 verfügbare Branchenpakete (Buchhalter, Anwalt, Restaurant, Immobilien usw.). Jedes Paket fügt branchenspezifische Kategorien hinzu.
- **KI-Paket**: Geben Sie Ihren Beruf ein, und die KI generiert benutzerdefinierte Kategorien.
- **Erstellen/Bearbeiten/Löschen**: Verwalten Sie Ihre Kategorien manuell.
- **Schlüsselwörter**: Jede Kategorie kann Schlüsselwörter haben, um die KI bei der Klassifizierung zu unterstützen.
- **Neu kategorisieren**: Schaltfläche, um die KI-Kategorisierung auf nicht klassifizierte E-Mails anzuwenden.

## 9. EINSTELLUNGEN
Konfiguration Ihres Kontos und der E-Mail-Verbindungen.

### Bereiche:
- **Profil**: Name und E-Mail-Signatur ändern.
- **E-Mail-Verbindungen**: Gmail (OAuth) verbinden, IMAP verbinden (Outlook, Hotmail, Orange, Free, SFR, Yahoo, Proximus, Telenet, iCloud, OVH, IONOS, Infomaniak und mehr).
- **Benachrichtigungen**: E-Mail-Benachrichtigungen aktivieren/deaktivieren.
- **KI-Einstellungen**: Verhalten der KI konfigurieren (Zusammenfassungssprache usw.).
- **Sprache**: Wählen Sie die Oberflächensprache (Französisch, Englisch, Niederländisch, Deutsch, Spanisch).
- **Sicherheit**: Passwort ändern.

## 10. ABONNEMENT
Verwaltung Ihres Tarifs und der Zahlung.

### Verfügbare Tarife:
- **Probe**: Kostenlos, 100 KI-E-Mails inklusive.
- **Starter**: 9 €/Monat, 500 E-Mails/Monat, 1 Postfach.
- **Pro**: 19 €/Monat, 2000 E-Mails/Monat, 3 Postfächer. (Empfohlen)
- **Business**: 39 €/Monat pro Sitz, unbegrenzte E-Mails, unbegrenzte Postfächer, geteilte Postfächer, Teamverwaltung.

### Funktionen:
- Aktuellen Tarif und Nutzung anzeigen.
- Tarif wechseln (Upgrade/Downgrade).
- Sichere Zahlung über Paddle.
- Abonnement kündigen.
- Rechnungsverlauf.

## 11. GETEILTE POSTFÄCHER (nur Business-Tarif)
Geteilte E-Mail-Postfächer zwischen Teammitgliedern.

### Funktionen:
- Geteiltes Postfach erstellen (z. B. contact@, info@, support@).
- Teammitglieder dem Postfach zuweisen.
- E-Mails des geteilten Postfachs anzeigen.
- Eine E-Mail beanspruchen (zur Bearbeitung zuweisen).
- Eine E-Mail freigeben (für das Team verfügbar machen).

## 12. TEAMVERWALTUNG (nur Business-Tarif)
Verwalten Sie die Mitglieder Ihrer Organisation.

### Funktionen:
- Mitglieder per E-Mail einladen.
- Rollen festlegen: Admin oder Mitglied.
- Mitgliederliste mit Status anzeigen.
- Mitglied aus dem Team entfernen.
- Teamaktivität anzeigen.

## 13. TEAMAKTIVITÄT (nur Business-Tarif)
Verfolgung der Aktivität von Organisationsmitgliedern.

### Funktionen:
- Aktivitätsübersicht jedes Mitglieds.
- Bearbeitete E-Mails pro Mitglied.
- Erledigte Aufgaben.

## 14. KI-CHAT-ASSISTENT
Schwebendes Chat-Widget rechts unten in der Anwendung. Stellen Sie Fragen in natürlicher Sprache zu jeder Funktion — der Assistent antwortet in Ihrer Sprache (FR/EN/NL/DE/ES). Ersetzt das alte statische Handbuch.

## 15. SPAM UND KI-FILTERUNG
Inboria verwendet eine mehrschichtige Filterung, um Lärm zu vermeiden und KI-Credits zu sparen.

### Deterministischer Vorfilter (vor der KI):
- **Noreply/Notification-Muster**: Adressen mit lokalen Teilen wie noreply, no-reply, donotreply, notification(s), alerts, mailer-daemon, postmaster, newsletter, bounce, digest, broadcast werden automatisch erkannt und in die Kategorie "Benachrichtigungen" einsortiert.
- **Absender-Cache**: Die Tabelle sender_cache merkt sich für jeden bereits gesehenen Absender Kategorie und Priorität. Die zweite E-Mail desselben Absenders vermeidet einen KI-Aufruf.
- **Deterministische Spam-Erkennung**: Vor jeder KI-Verarbeitung markiert der Vorfilter E-Mails mit klaren Signalen (Massensendungen, bekannte Signaturen) als Spam.

### Automatische Spam-Kategorisierung:
- **KI-Entscheidung**: E-Mails ohne Vorfilter-Treffer durchlaufen GPT-4o-mini, das entscheidet, ob es sich um Spam handelt.
- **Spam-Ordner**: In der Seitenleiste zugänglich, sammelt alle als Spam markierten E-Mails.
- **Keine vergeudeten Credits**: Eine vorgefilterte E-Mail verbraucht keine KI-Credits.

### Manuelle Neuklassifizierung:
- **Wiederherstellen**: Aus dem Spam-Ordner mit einem Klick zurück in den Posteingang.
- **Als Spam markieren**: Aus dem Posteingang eine E-Mail in Spam verschieben.
- **Lernen über den Cache**: Wiederherstellungen und Markierungen aktualisieren sender_cache für zukünftige E-Mails.
- **Spam leeren**: Schaltfläche, um alle Spam-E-Mails endgültig zu löschen, mit Bestätigung.
- **Einzelne Löschung**: Eine Spam-E-Mail einzeln löschen, ebenfalls mit Bestätigung.

## 16. INTELLIGENTES SENDEN (Welle 1)
Drei Funktionen zur besseren Kontrolle Ihres Postfachs.

### E-Mail aufschieben (Snooze)
- **Wie**: Öffnen Sie eine E-Mail, klicken Sie auf das Uhrsymbol "Aufschieben" und wählen Sie ein Datum/Uhrzeit oder einen Schnellzugriff (Heute Abend, Morgen früh, Nächsten Montag, Benutzerdefiniert).
- **Effekt**: Die E-Mail verschwindet vorübergehend aus dem Posteingang und erscheint zur gewählten Zeit automatisch wieder als ungelesen.
- **Wo finden**: Seite **Aufgeschoben** im linken Menü (unter Geplant). Sie können sie sofort "Aufschiebung deaktivieren".

### Senden planen
- **Wie**: Im Composer (Neu oder Antwort) auf den Pfeil neben Senden klicken und "Später senden" wählen. Datum und Uhrzeit auswählen.
- **Effekt**: Die E-Mail wird automatisch zur geplanten Zeit gesendet. Sie können sie vor dem Senden abbrechen oder bearbeiten.
- **Wo sehen**: Seite **Geplant** im linken Menü.

### Senden rückgängig (Undo Send)
- **Wie**: Nach Klick auf Senden in einer Antwort erscheint unten ein Toast mit einer "Rückgängig"-Schaltfläche für 10 Sekunden.
- **Effekt**: Bei Klick auf Rückgängig innerhalb von 10s wird die E-Mail nie gesendet.

### Öffnungsverfolgung (Tracking)
- Indikator bei gesendeten E-Mails: "Gesehen" oder "Nicht gesehen".
- Diskret, datenschutzkonform (transparenter unsichtbarer Pixel).

## 17. KI-VORLAGEN (Welle 2)
Bibliothek wiederverwendbarer Standardantworten mit KI-Unterstützung.

### Vorlage erstellen
- **Manuell**: Seite **Einstellungen → Vorlagen**, Schaltfläche "Neue Vorlage". Geben Sie Name, Betreff und Inhalt an. Die KI kann einen Namen basierend auf dem Inhalt vorschlagen.
- **Aus einer gesendeten E-Mail**: Im Composer nach dem Senden auf "Als Vorlage speichern" klicken.
- **KI-Kategorisierung**: Jede Vorlage erhält ein automatisches Tag (Angebot, Erinnerung, Termin, Ablehnung, Dank, Nachverfolgung, Sonstiges).

### Vorlage verwenden
- **Automatische Vorschläge**: Beim Öffnen einer Antwort zeigt ein Banner oben im Composer 1 bis 3 relevante Vorlagen für den Kontext an.
- **Einfügen mit 1 Klick**: Klicken Sie auf den Vorschlag, um die Vorlage in die Antwort einzufügen.
- **Variablen**: Wenn die Vorlage Variablen enthält (z. B. {{vorname}}), werden sie nach Möglichkeit automatisch ausgefüllt.

### Vorlagen verwalten
- Seite **Einstellungen → Vorlagen**: Liste nach Kategorie gruppiert, Suche, Bearbeiten, Löschen.
- Nutzungszähler: sehen Sie, wie oft jede Vorlage verwendet wurde.

## 18. AUTOMATISCHE REGELN (Welle 2)
Automatisieren Sie die Verarbeitung bestimmter E-Mails in natürlicher Sprache.

### Regel erstellen
- **Seite**: **Einstellungen → Regeln**, Schaltfläche "Neue Regel".
- **In natürlicher Sprache**: Tippen Sie z. B. "Wenn ein Kunde Angebot erwähnt, in Vertrieb einsortieren und mich benachrichtigen". Die KI übersetzt den Satz in eine strukturierte Regel.
- **Mögliche Bedingungen**: Absender enthält X, Betreff enthält X, Inhalt enthält X, KI-Kategorie = X, Priorität = X.
- **Mögliche Aktionen**: In Kategorie einsortieren, Als prioritär markieren, Benachrichtigen, Archivieren, Mitglied zuweisen, Aufgabe erstellen.

### Vor dem Aktivieren testen (Simulator)
- **"Simulieren"-Schaltfläche**: Vor der Aktivierung den Simulator starten. Er zeigt, welche E-Mails der letzten 30 Tage betroffen wären.
- **Sicherheit**: Vermeidet Überraschungen.

### Nachverfolgung und Rollback
- **Zähler**: Jede Regel zeigt, wie oft sie ausgelöst wurde.
- **Audit-Protokoll**: Liste aller Aktionen, die Regeln in den letzten 24h ausgeführt haben.
- **Rückgängig mit 1 Klick**: Für jede Aktion der letzten 24h Schaltfläche "Rückgängig", die den vorherigen Zustand wiederherstellt.

### Ein/Aus
- Schalter an jeder Regel, um sie zu pausieren, ohne sie zu löschen.

## 19. CRM-INTEGRATIONEN

Inboria verbindet sich nativ mit 4 führenden CRMs: HubSpot, Pipedrive, Salesforce und Odoo. Die Synchronisation ist bidirektional und automatisch.

### Unterstützte CRMs
- **HubSpot**: Synchronisation von Kontakten und Deals.
- **Pipedrive**: Synchronisation von Personen, Deals und Organisationen.
- **Salesforce**: Synchronisation von Kontakten, Accounts und Opportunities. Sandbox-Modus verfügbar (Toggle bei der Verbindung Richtung test.salesforce.com), um vor dem Wechsel in die Produktion zu testen.
- **Odoo**: Synchronisation von Kontakten (res.partner) und Opportunities (crm.lead). Authentifizierung per Instanz-URL + Datenbank + Login + API-Key (in Odoo erstellt: Profil → Kontosicherheit → Neuer API-Key). Kein OAuth — Odoo bietet kein Standard-OAuth.

### Ein CRM verbinden
1. Gehen Sie zu Einstellungen → CRM.
2. Klicken Sie neben dem gewünschten CRM auf "Verbinden".
3. Sie werden zur offiziellen OAuth-Anmeldeseite des CRM weitergeleitet.
4. Sie autorisieren Inboria, auf Ihre Kontakte und Deals zuzugreifen.
5. Eine initiale Synchronisation läuft automatisch.

### Automatische Synchronisation
- **HubSpot und Pipedrive**: automatische Synchronisation alle 15 Minuten im Hintergrund (Planer \`crm-sync-scheduler\`).
- **Salesforce**: initiale Synchronisation bei Verbindung + manuelle Schaltfläche "Jetzt synchronisieren" jederzeit verfügbar in Einstellungen → CRM.
- **Bidirektional**: Änderungen im CRM fließen in Inboria zurück, neue Kontakte in Inboria können im CRM angelegt werden.
- **Manuelle Sync für alle CRMs**: Schaltfläche "Jetzt synchronisieren" in Einstellungen → CRM. Zeigt die Anzahl synchronisierter Kontakte und Deals.
- **Datum der letzten Sync**: sichtbar auf der Karte jedes verbundenen CRM.

### Was der Nutzer in Inboria sieht
- Trifft eine E-Mail ein, identifiziert Inboria automatisch den entsprechenden Kontakt im verbundenen CRM.
- Laufende Deals/Opportunities mit diesem Kontakt sind aus der E-Mail heraus sichtbar.
- Neue Informationen aus einem Gespräch können das CRM anreichern.

### OAuth-Sicherheit
- **Kein Passwort gespeichert**: Inboria nutzt ausschließlich OAuth.
- **Tokens verschlüsselt im Ruhezustand** in der Datenbank.
- **Jederzeit widerrufbar**: aus dem CRM (Seite Verbundene Apps) oder aus Einstellungen → CRM in Inboria.
- **TLS-verschlüsselte** End-to-End-Übertragung.

### Salesforce-Besonderheiten
- Sandbox-Toggle für test.salesforce.com (empfohlen für Mittelstand/Großkunden: zuerst auf einer Sandbox-Org testen, bevor die Produktion verbunden wird).
- Lightning Experience kompatibel.
- Das \`workspaceName\`-Badge zeigt "(Sandbox)" bei einer Sandbox-Verbindung.

### Trennung
- Schaltfläche "Trennen" in Einstellungen → CRM.
- Synchronisation stoppt sofort.
- Access-Tokens werden auf Inboria-Seite widerrufen.
- Daten innerhalb von Inboria bleiben verfügbar; das CRM wird nicht verändert.

### Mehrere CRMs parallel
- HubSpot + Pipedrive + Salesforce können gleichzeitig verbunden sein.
- Jede E-Mail wird mit Informationen aus allen verbundenen CRMs angereichert.

### Keine Datendopplung
- Inboria speichert nur minimale Referenzen (ID, Name, E-Mail), um E-Mails mit dem CRM zu verknüpfen.
- Das CRM bleibt die einzige Quelle der Wahrheit.

## HÄUFIG GESTELLTE FRAGEN

### Wie verbinde ich mein E-Mail-Konto?
Gehen Sie zu Einstellungen → E-Mail-Verbindungen. Wählen Sie Ihren Anbieter (Gmail, Outlook usw.). Für Gmail werden Sie zu Google weitergeleitet. Für andere geben Sie Ihre E-Mail-Adresse und Ihr IMAP-Passwort ein.

### Warum werden meine E-Mails nicht synchronisiert?
Synchronisation erfolgt automatisch alle 5 Minuten. Wenn keine E-Mails erscheinen: Verbindung in Einstellungen prüfen, Zugangsdaten und IMAP-Zugang beim Anbieter überprüfen.

### Wie kategorisiert die KI meine E-Mails?
Die KI analysiert Betreff, Absender und Inhalt jeder E-Mail, um Priorität (Dringend, Mittel, Niedrig), Kategorie und Zusammenfassung zu bestimmen.

### Sind meine Daten sicher?
Ja. Inboria verwendet SSL/TLS-Verschlüsselung. Wir speichern den vollständigen Inhalt nicht dauerhaft — nur Metadaten und Zusammenfassungen.

### Wie ändere ich die Sprache?
Klicken Sie auf den Sprachwähler oben rechts im Dashboard. Wählen Sie zwischen Französisch, Englisch, Niederländisch, Deutsch oder Spanisch.

### Wie erstelle ich einen KI-Entwurf?
Öffnen Sie eine E-Mail und klicken Sie auf das Zauberstab-Symbol (✨). Die KI generiert einen Antwortentwurf zum Bearbeiten.

### Wie exportiere ich meine Aufgaben?
Aufgaben → Schaltfläche "CSV exportieren" oben.

### Wie kündige ich mein Abonnement?
Abonnement → "Abonnement verwalten" → Paddle-Portal.

### Was ist ein Branchenpaket?
Ein Branchenpaket ist eine Sammlung vordefinierter Kategorien für Ihren Beruf. Beispielsweise enthält das Paket "Buchhalter" Kategorien wie Kundenrechnungen, Steuererklärungen.

### Wie funktionieren KI-Credits?
Jeder Tarif enthält monatliche KI-Credits. Ein Credit wird pro KI-Verarbeitung verbraucht. Ihre Nutzung sehen Sie in der Seitenleiste unten. Bei Erschöpfung müssen Sie upgraden.

### Kann ich mehrere E-Mail-Konten verbinden?
Ja, je nach Tarif: Starter = 1 Postfach, Pro = 3, Business = unbegrenzt.

### Wie weise ich eine E-Mail einem Kollegen zu?
Nur Business: E-Mail öffnen → "Zuweisen" → Mitglied wählen.

### Wie verwende ich den Kalender?
Der Kalender zeigt Ihre Termine. Die KI erkennt Termine in E-Mails. Sie können auch manuell Termine erstellen. Ansicht (Tag/Woche/Monat) oben wechseln.`,

    es: `# Inboria — Base de conocimientos completa

## Visión general
Inboria es un asistente de correo inteligente con IA, diseñado para PYMES en Bélgica y Francia. Ordena, clasifica y resume automáticamente sus correos profesionales. La aplicación funciona en francés, inglés, neerlandés, alemán y español.

## 1. BANDEJA DE ENTRADA
La página principal muestra todos los correos entrantes con clasificación inteligente por IA.

### Funciones:
- **Clasificación por prioridad**: Cada correo recibe automáticamente una prioridad (Urgente 🔴, Media 🟡, Baja 🟢) asignada por la IA.
- **Resumen IA**: Cada correo tiene un resumen breve generado por la IA, visible sin abrir.
- **Categorización automática**: La IA clasifica los correos en categorías (Facturas, Soporte, Comercial, etc.).
- **Búsqueda**: Barra de búsqueda para encontrar un correo por remitente, asunto o contenido.
- **Filtros**: Filtrar por categoría, prioridad, estado (leído/no leído, archivado).
- **Acciones**: Responder, Archivar, Eliminar, Crear una tarea, Crear una cita.
- **Selección múltiple**: Seleccionar varios correos para archivar o eliminar en lote.
- **Redactar correo**: Botón para redactar un nuevo correo con asistencia IA.
- **Borrador IA**: La IA puede generar un borrador de respuesta basado en el contexto. Haga clic en el icono de varita mágica.
- **Adjuntos**: Ver y descargar adjuntos recibidos. Añadir adjuntos al enviar.
- **Comentarios**: Añadir notas internas en un correo (visibles solo para usted y su equipo).
- **Asignar**: Asignar un correo a un miembro del equipo (solo plan Business).
- **Paginación**: Los correos se cargan en lotes de 50 para mejor rendimiento.

### Cómo funciona:
1. Conecte su cuenta de correo en Ajustes (Gmail OAuth o IMAP).
2. Inboria sincroniza sus correos automáticamente cada 5 minutos.
3. La IA analiza cada correo: prioridad, categoría, resumen.
4. Verá sus correos clasificados inteligentemente en la bandeja.

## 2. ENVIADOS
Muestra todos los correos que ha enviado desde Inboria.

### Funciones:
- Lista de correos enviados con destinatario, asunto, fecha.
- Búsqueda en correos enviados.
- Ver el contenido completo de un correo enviado.
- Ver los adjuntos enviados.

## 3. TAREAS
La IA detecta automáticamente las tareas en sus correos y las lista aquí.

### Funciones:
- **Tareas IA**: Detectadas automáticamente (ej.: "Por favor envíe el presupuesto" → tarea creada).
- **Tareas manuales**: También puede crear tareas manualmente con título y descripción.
- **Filtrar**: Ver todas, solo IA, o solo manuales.
- **Insignias**: Contadores para total, IA y manuales.
- **Marcar como hecho**: Marque para completar una tarea.
- **Ver correo origen**: Para tareas IA, haga clic para ver el correo original.
- **Exportar CSV**: Exporte todas sus tareas en archivo CSV.

## 4. PROYECTOS
Organice sus correos por proyecto para un seguimiento temático.

### Funciones:
- **Crear un proyecto**: Asigne nombre y descripción.
- **Asociar correos**: Desde la bandeja, asigne un correo a un proyecto.
- **Vista proyecto**: Ver todos los correos asociados a un proyecto.
- **Estado del proyecto**: Activo o archivado.

## 5. AGENDA / CALENDARIO
Vista de calendario con detección automática de citas por la IA.

### Funciones:
- **Vistas**: Día, Semana, Mes — cambie la vista con los botones superiores.
- **Detección IA**: La IA analiza sus correos y detecta automáticamente citas mencionadas.
- **Sugerencias IA**: Las citas detectadas aparecen como sugerencias para confirmar o ignorar.
- **Crear manualmente**: Cree una cita con título, fecha, hora, lugar y participantes.
- **Citas hoy/mañana**: Panel lateral con próximas citas.
- **Exportar CSV**: Exporte su agenda en CSV.
- **Ver correo origen**: Para citas detectadas por IA, acceda al correo original.

## 6. ARCHIVOS
Correos archivados. Ya no están en la bandeja pero permanecen accesibles.

### Funciones:
- Lista de correos archivados.
- Búsqueda en archivos.
- Restaurar un correo archivado (devolverlo a la bandeja).
- Eliminación definitiva.
- Papelera con opción "Vaciar papelera".

## 7. INFORME DIARIO
Resumen diario generado por IA de su actividad.

### Funciones:
- **Resumen IA**: Visión general de los correos del día (recibidos, urgentes, tratados).
- **Puntos de atención**: La IA identifica correos importantes que requieren su atención.
- **Estadísticas**: Gráficos de actividad.
- **Salud del buzón**: Indicador de salud (correos pendientes, tiempo medio de respuesta).
- **Generar**: Botón para generar/regenerar el informe del día.

## 8. CLASIFICACIÓN (Categorías)
Gestione las categorías que la IA usa para clasificar sus correos.

### Funciones:
- **Categorías por defecto**: Facturas, Soporte, Comercial, Admin, Personal, etc.
- **Packs sectoriales**: Más de 50 packs disponibles (Contable, Abogado, Restaurante, Inmobiliaria, etc.). Cada pack añade categorías específicas.
- **Pack IA**: Indique su profesión y la IA genera categorías personalizadas.
- **Crear/Modificar/Eliminar**: Gestione manualmente.
- **Palabras clave**: Cada categoría puede tener palabras clave para ayudar a la IA.
- **Recategorizar**: Botón para relanzar la categorización IA en correos sin clasificar.

## 9. AJUSTES
Configuración de cuenta y conexiones de correo.

### Secciones:
- **Perfil**: Modificar nombre y firma.
- **Conexiones de correo**: Conectar Gmail (OAuth), conectar vía IMAP (Outlook, Hotmail, Orange, Free, SFR, Yahoo, Proximus, Telenet, iCloud, OVH, IONOS, Infomaniak y más).
- **Notificaciones**: Activar/desactivar notificaciones.
- **Preferencias IA**: Configurar el comportamiento de la IA.
- **Idioma**: Elegir idioma de la interfaz (Francés, Inglés, Neerlandés, Alemán, Español).
- **Seguridad**: Cambiar su contraseña.

## 10. SUSCRIPCIÓN
Gestión de su plan y pago.

### Planes disponibles:
- **Prueba**: Gratis, 100 correos IA incluidos.
- **Starter**: 9 €/mes, 500 correos/mes, 1 buzón.
- **Pro**: 19 €/mes, 2000 correos/mes, 3 buzones. (Recomendado)
- **Business**: 39 €/mes por puesto, correos ilimitados, buzones ilimitados, buzones compartidos, gestión de equipo.

### Funciones:
- Ver plan actual y uso.
- Cambiar de plan.
- Pago seguro vía Paddle.
- Cancelar suscripción.
- Historial de facturación.

## 11. BUZONES COMPARTIDOS (solo plan Business)
Buzones compartidos entre miembros del equipo.

### Funciones:
- Crear un buzón compartido (ej.: contact@, info@, support@).
- Asignar miembros al buzón.
- Ver correos del buzón compartido.
- Reclamar un correo (asignárselo).
- Liberar un correo.

## 12. GESTIÓN DE EQUIPO (solo plan Business)
Gestione los miembros de su organización.

### Funciones:
- Invitar miembros por correo.
- Definir roles: Admin o Miembro.
- Ver lista de miembros con estado.
- Retirar un miembro del equipo.
- Ver actividad del equipo.

## 13. ACTIVIDAD DEL EQUIPO (solo plan Business)
Seguimiento de la actividad de los miembros.

### Funciones:
- Vista general de actividad por miembro.
- Correos tratados por miembro.
- Tareas completadas.

## 14. ASISTENTE CHAT IA
Widget de chat flotante en la esquina inferior derecha de la aplicación. Haga preguntas en lenguaje natural sobre cualquier función — el asistente responde en su idioma (FR/EN/NL/DE/ES). Reemplaza el antiguo manual estático.

## 15. SPAM Y FILTRADO IA
Inboria utiliza filtrado en varias capas para evitar ruido y ahorrar créditos IA.

### Pre-filtro determinista (antes de la IA):
- **Patrón noreply/notificaciones**: Direcciones cuya parte local coincide con noreply, no-reply, donotreply, notification(s), alerts, mailer-daemon, postmaster, newsletter, bounce, digest, broadcast son reconocidas automáticamente y clasificadas en "Notificaciones".
- **Caché de remitentes**: La tabla sender_cache memoriza categoría y prioridad de cada remitente ya visto. El segundo correo del mismo remitente evita una llamada IA.
- **Detección de spam determinista**: Antes de cualquier procesamiento IA, el pre-filtro marca como spam los correos con señales claras (envíos masivos, firmas conocidas).

### Categorización automática en spam:
- **Decisión IA**: Los correos no cubiertos por el pre-filtro pasan por GPT-4o-mini, que decide si son spam.
- **Carpeta Spam**: Accesible desde la barra lateral, agrupa todos los correos marcados como spam.
- **Sin créditos malgastados**: Un correo pre-filtrado no consume crédito IA.

### Reclasificación manual:
- **Restaurar**: Desde Spam, un clic devuelve un correo legítimo a la bandeja.
- **Marcar como spam**: Desde la bandeja, puede forzar un correo a Spam.
- **Aprendizaje por caché**: Sus restauraciones y marcados alimentan sender_cache.
- **Vaciar spam**: Botón para eliminar definitivamente todo el spam, con confirmación.
- **Eliminación individual**: Elimine un correo spam individualmente, con confirmación.

## 16. ENVÍO INTELIGENTE (Ola 1)
Tres funciones para controlar mejor sus envíos y su buzón.

### Posponer un correo (Snooze)
- **Cómo**: Abra un correo, haga clic en el icono de reloj "Posponer" y elija fecha/hora o un atajo (Esta noche, Mañana por la mañana, Próximo lunes, Personalizado).
- **Efecto**: El correo desaparece temporalmente de la bandeja y reaparece automáticamente a la hora elegida como nuevo no leído.
- **Dónde encontrar**: Página **Pospuestos** en el menú izquierdo (debajo de Programados). Puede "Desactivar el aplazamiento" para traerlos de inmediato.

### Programar un envío
- **Cómo**: En el composer (nuevo o respuesta), haga clic en la flecha junto a Enviar y elija "Enviar más tarde". Seleccione fecha y hora.
- **Efecto**: El correo se envía automáticamente a la hora prevista. Puede cancelarlo o modificarlo antes.
- **Dónde ver los envíos programados**: Página **Programados** en el menú izquierdo.

### Cancelar un envío (Undo Send)
- **Cómo**: Después de hacer clic en Enviar en una respuesta, aparece un toast abajo con un botón "Cancelar" durante 10 segundos.
- **Efecto**: Si hace clic en Cancelar dentro de 10s, el correo no se envía.

### Seguimiento de apertura (Tracking)
- Indicador en correos enviados: "Visto" o "No visto" según si el destinatario abrió.
- Discreto, respetuoso con la privacidad (píxel transparente invisible).

## 17. PLANTILLAS IA (Ola 2)
Biblioteca de respuestas-tipo reutilizables, con asistencia IA.

### Crear una plantilla
- **Manualmente**: Página **Ajustes → Plantillas**, botón "Nueva plantilla". Asigne nombre, asunto y cuerpo. La IA puede sugerir un nombre basado en el contenido.
- **Desde un correo enviado**: En el composer, después de enviar, haga clic en "Guardar como plantilla".
- **Categorización IA**: Cada plantilla recibe una etiqueta automática (presupuesto, recordatorio, cita, rechazo, agradecimiento, seguimiento, otro).

### Usar una plantilla
- **Sugerencias automáticas**: Al abrir una respuesta, una banda en la parte superior muestra 1 a 3 plantillas relevantes para el contexto del correo recibido.
- **Inserción en 1 clic**: Haga clic en la sugerencia para insertar la plantilla.
- **Variables**: Si la plantilla contiene variables (ej.: {{nombre}}), se rellenan automáticamente cuando es posible.

### Gestionar plantillas
- Página **Ajustes → Plantillas**: lista agrupada por categoría, búsqueda, edición, eliminación.
- Contador de uso: vea cuántas veces se ha usado cada plantilla.

## 18. REGLAS AUTOMÁTICAS (Ola 2)
Automatice el tratamiento de ciertos correos en lenguaje natural.

### Crear una regla
- **Página**: **Ajustes → Reglas**, botón "Nueva regla".
- **En lenguaje natural**: Escriba por ejemplo "Si un cliente menciona presupuesto, clasificar en Comercial y avisarme". La IA traduce la frase en una regla estructurada (condiciones + acciones).
- **Condiciones posibles**: Remitente contiene X, Asunto contiene X, Cuerpo contiene X, Categoría IA = X, Prioridad = X.
- **Acciones posibles**: Clasificar en categoría, Marcar prioritario, Notificar, Archivar, Asignar a un miembro, Crear una tarea.

### Probar antes de activar (Simulador)
- **Botón "Simular"**: Antes de activar una regla, lance el simulador. Le muestra qué correos de los últimos 30 días habrían sido afectados.
- **Seguridad**: Evita sorpresas.

### Seguimiento y rollback
- **Contador**: Cada regla muestra cuántas veces se ha activado.
- **Registro de auditoría**: Lista de todas las acciones ejecutadas en las últimas 24h.
- **Cancelar en 1 clic**: Para cada acción de las últimas 24h, botón "Cancelar" que restaura el estado anterior.

### On/Off
- Interruptor en cada regla para pausarla sin eliminarla.

## 19. INTEGRACIONES CRM

Inboria se conecta de forma nativa a 4 CRM líderes del mercado: HubSpot, Pipedrive, Salesforce y Odoo. La sincronización es bidireccional y automática.

### CRM compatibles
- **HubSpot**: sincronización de contactos y deals.
- **Pipedrive**: sincronización de personas, deals y organizaciones.
- **Salesforce**: sincronización de contactos, cuentas y oportunidades. Modo Sandbox disponible (toggle al conectar hacia test.salesforce.com) para probar antes de pasar a Producción.
- **Odoo**: sincronización de contactos (res.partner) y oportunidades (crm.lead). Autenticación por URL de instancia + base de datos + login + clave API (generada en Odoo: Perfil → Seguridad de la cuenta → Nueva clave API). Sin OAuth — Odoo no expone OAuth estándar.

### Cómo conectar un CRM
1. Vaya a Configuración → CRM.
2. Pulse "Conectar" junto al CRM elegido.
3. Será redirigido a la página oficial de OAuth del CRM.
4. Autoriza a Inboria para acceder a sus contactos y deals.
5. Se ejecuta una sincronización inicial automáticamente.

### Sincronización automática
- **HubSpot y Pipedrive**: sincronización automática cada 15 minutos en segundo plano (planificador \`crm-sync-scheduler\`).
- **Salesforce**: sincronización inicial al conectar + botón manual "Sincronizar ahora" disponible en cualquier momento en Configuración → CRM.
- **Bidireccional**: los cambios en el CRM llegan a Inboria, y los nuevos contactos en Inboria pueden crearse en el CRM.
- **Sincronización manual para todos los CRM**: botón "Sincronizar ahora" en Configuración → CRM. Muestra el número de contactos y deals sincronizados.
- **Fecha de la última sincronización**: visible en la tarjeta de cada CRM conectado.

### Lo que el usuario ve en Inboria
- Cuando llega un correo, Inboria identifica automáticamente el contacto correspondiente en el CRM conectado.
- Los deals/oportunidades en curso con ese contacto son visibles desde el correo.
- La nueva información de una conversación puede enriquecer el CRM.

### Seguridad OAuth
- **Sin contraseñas almacenadas**: Inboria utiliza únicamente OAuth.
- **Tokens cifrados en reposo** en la base de datos.
- **Revocación en cualquier momento**: desde el CRM (página Aplicaciones conectadas) o desde Configuración → CRM en Inboria.
- **Intercambios cifrados TLS** de extremo a extremo.

### Particularidades de Salesforce
- Toggle Sandbox para apuntar a test.salesforce.com (recomendado para mediana/gran empresa: probar primero en una org Sandbox).
- Compatible con Lightning Experience.
- La insignia \`workspaceName\` muestra "(Sandbox)" cuando la conexión es Sandbox.

### Desconexión
- Botón "Desconectar" en Configuración → CRM.
- La sincronización se detiene de inmediato.
- Los tokens de acceso se revocan en el lado de Inboria.
- Los datos en Inboria siguen disponibles; el CRM no se modifica.

### Varios CRM en paralelo
- Es posible conectar HubSpot + Pipedrive + Salesforce a la vez.
- Cada correo se enriquece con la información de todos los CRM conectados.

### Sin duplicación de datos
- Inboria solo almacena referencias mínimas (ID, nombre, correo) para vincular correos con el CRM.
- El CRM sigue siendo la única fuente de verdad.

## PREGUNTAS FRECUENTES

### ¿Cómo conecto mi cuenta de correo?
Vaya a Ajustes → Conexiones de correo. Elija su proveedor (Gmail, Outlook, etc.). Para Gmail, será redirigido a Google. Para otros, introduzca su correo y contraseña IMAP.

### ¿Por qué no se sincronizan mis correos?
La sincronización se realiza automáticamente cada 5 minutos. Si no aparecen: verifique la conexión en Ajustes, credenciales correctas, acceso IMAP activado.

### ¿Cómo clasifica la IA mis correos?
La IA analiza asunto, remitente y contenido para determinar prioridad (Urgente, Media, Baja), categoría y generar resumen.

### ¿Mis datos están seguros?
Sí. Inboria usa cifrado SSL/TLS. No almacenamos el contenido completo permanentemente — solo metadatos y resúmenes.

### ¿Cómo cambio el idioma?
Haga clic en el selector de idioma arriba a la derecha. Elija entre Francés, Inglés, Neerlandés, Alemán o Español.

### ¿Cómo creo un borrador IA?
Abra un correo y haga clic en el icono de varita mágica (✨). La IA genera un borrador para editar.

### ¿Cómo exporto mis tareas?
Tareas → botón "Exportar CSV" arriba.

### ¿Cómo cancelo mi suscripción?
Suscripción → "Gestionar suscripción" → portal Paddle.

### ¿Qué es un Pack Sectorial?
Un Pack Sectorial es un conjunto de categorías predefinidas adaptadas a su sector. Por ejemplo, el pack "Contable" incluye Facturas clientes, Declaraciones fiscales, etc.

### ¿Cómo funcionan los créditos IA?
Cada plan incluye créditos IA mensuales. Un crédito se consume por cada procesamiento IA. Vea su consumo en la barra lateral abajo. Al agotarse, debe pasar a un plan superior.

### ¿Puedo conectar varias cuentas?
Sí, según plan: Starter = 1, Pro = 3, Business = ilimitado.

### ¿Cómo asigno un correo a un colega?
Solo Business: abra el correo → "Asignar" → elija miembro.

### ¿Cómo uso la agenda?
La agenda muestra sus citas. La IA detecta automáticamente las citas mencionadas en correos. También puede crear citas manualmente. Cambie de vista (día/semana/mes) con los botones superiores.`,
  };

  return kb[language] || kb.fr;
}

export function getSystemPrompt(language: "fr" | "en" | "nl" | "de" | "es" | "it" | "pt" | "pl" | "ro" | "sv" | "da" | "fi" | "hu" | "cs" | "tr" | "ja" | "ko" | "vi" | "th" | "id" | "ms" | "el" | "uk" | "et" | string): string {
  const prompts: Record<string, string> = {
    fr: `Tu es l'assistant de support de Inboria, un outil de gestion d'emails intelligent propulsé par l'IA pour les PME. Tu réponds aux questions des utilisateurs sur les fonctionnalités de l'application de manière claire, concise et amicale. Tu réponds TOUJOURS en français. Tu es poli et professionnel. Si tu ne connais pas la réponse, dis-le honnêtement et suggère de contacter le support par email à support@inboria.com. Ne parle jamais de sujets non liés à Inboria. Garde tes réponses courtes et utiles (max 3-4 paragraphes).`,
    en: `You are Inboria's support assistant, an AI-powered intelligent email management tool for SMEs. You answer user questions about the application's features in a clear, concise, and friendly manner. You ALWAYS respond in English. You are polite and professional. If you don't know the answer, say so honestly and suggest contacting support by email at support@inboria.com. Never discuss topics unrelated to Inboria. Keep your answers short and helpful (max 3-4 paragraphs).`,
    nl: `Je bent de support-assistent van Inboria, een AI-aangedreven intelligent e-mailbeheertool voor KMO's. Je beantwoordt vragen van gebruikers over de functies van de applicatie op een duidelijke, beknopte en vriendelijke manier. Je antwoordt ALTIJD in het Nederlands. Je bent beleefd en professioneel. Als je het antwoord niet weet, zeg dat dan eerlijk en stel voor om contact op te nemen met de support via e-mail op support@inboria.com. Bespreek nooit onderwerpen die niet gerelateerd zijn aan Inboria. Houd je antwoorden kort en nuttig (max 3-4 paragrafen).`,
    de: `Du bist der Support-Assistent von Inboria, einem KI-gestützten intelligenten E-Mail-Verwaltungstool für KMU. Du beantwortest Benutzerfragen zu den Funktionen der Anwendung klar, prägnant und freundlich. Du antwortest IMMER auf Deutsch. Du bist höflich und professionell. Wenn du die Antwort nicht kennst, sage das ehrlich und schlage vor, den Support per E-Mail unter support@inboria.com zu kontaktieren. Sprich niemals über Themen, die nichts mit Inboria zu tun haben. Halte deine Antworten kurz und hilfreich (max. 3-4 Absätze).`,
    es: `Eres el asistente de soporte de Inboria, una herramienta inteligente de gestión de correo electrónico con IA para PYMES. Respondes a las preguntas de los usuarios sobre las funciones de la aplicación de manera clara, concisa y amigable. SIEMPRE respondes en español. Eres educado y profesional. Si no conoces la respuesta, dilo con honestidad y sugiere contactar al soporte por correo a support@inboria.com. Nunca hables de temas no relacionados con Inboria. Mantén tus respuestas cortas y útiles (máx. 3-4 párrafos).`,
    it: `Sei l'assistente di supporto di Inboria, uno strumento intelligente di gestione email basato sull'IA per le PMI. Rispondi alle domande degli utenti sulle funzionalità dell'applicazione in modo chiaro, conciso e cordiale. Rispondi SEMPRE in italiano, usando la forma di cortesia (Lei). Sei educato e professionale. Se non conosci la risposta, dillo onestamente e suggerisci di contattare il supporto via email a support@inboria.com. Non parlare mai di argomenti non correlati a Inboria. Mantieni le risposte brevi e utili (max 3-4 paragrafi). La base di conoscenza fornita può essere in francese o inglese: traduci e adatta i concetti in italiano nelle tue risposte.`,
    pt: `É o assistente de suporte do Inboria, uma ferramenta inteligente de gestão de emails com IA para PMEs. Responde às perguntas dos utilizadores sobre as funcionalidades da aplicação de forma clara, concisa e cordial. Responde SEMPRE em português europeu (pt-PT), usando a forma formal (você). É educado e profissional. Se não souber a resposta, diga-o honestamente e sugira contactar o suporte por email para support@inboria.com. Nunca fale de temas não relacionados com o Inboria. Mantenha as respostas curtas e úteis (máx. 3-4 parágrafos). A base de conhecimento fornecida pode estar em francês ou inglês: traduza e adapte os conceitos para português nas suas respostas.`,
    pl: `Jesteś asystentem wsparcia Inboria, inteligentnego narzędzia do zarządzania pocztą e-mail opartego na AI dla MŚP. Odpowiadasz na pytania użytkowników dotyczące funkcji aplikacji w sposób jasny, zwięzły i przyjazny. ZAWSZE odpowiadasz po polsku, używając formy grzecznościowej (Pan/Pani). Jesteś uprzejmy i profesjonalny. Jeśli nie znasz odpowiedzi, powiedz to szczerze i zasugeruj skontaktowanie się ze wsparciem pod adresem support@inboria.com. Nigdy nie rozmawiaj o tematach niezwiązanych z Inboria. Odpowiedzi powinny być krótkie i pomocne (maks. 3-4 akapity). Dostarczona baza wiedzy może być w języku francuskim lub angielskim: przetłumacz i dostosuj koncepcje na polski w swoich odpowiedziach.`,
    ro: `Sunteți asistentul de suport al Inboria, un instrument inteligent de gestionare a emailurilor bazat pe AI pentru IMM-uri. Răspundeți la întrebările utilizatorilor despre funcționalitățile aplicației într-un mod clar, concis și prietenos. Răspundeți ÎNTOTDEAUNA în limba română, folosind forma de politețe (dumneavoastră). Sunteți politicos și profesional. Dacă nu cunoașteți răspunsul, spuneți-o sincer și sugerați să contacteze suportul prin email la support@inboria.com. Nu discutați niciodată subiecte care nu au legătură cu Inboria. Păstrați răspunsurile scurte și utile (max. 3-4 paragrafe). Baza de cunoștințe furnizată poate fi în franceză sau engleză: traduceți și adaptați conceptele în română în răspunsurile dumneavoastră.`,
    sv: `Du är Inborias supportassistent, ett AI-drivet intelligent e-posthanteringsverktyg för små och medelstora företag. Du svarar på användarnas frågor om applikationens funktioner på ett tydligt, kortfattat och vänligt sätt. Du svarar ALLTID på svenska, med en modern professionell B2B-ton (du). Du är artig och professionell. Om du inte vet svaret, säg det ärligt och föreslå att kontakta support via e-post på support@inboria.com. Diskutera aldrig ämnen som inte är relaterade till Inboria. Håll dina svar korta och hjälpsamma (max 3-4 stycken). Den tillhandahållna kunskapsbasen kan vara på franska eller engelska: översätt och anpassa koncepten till svenska i dina svar.`,
    da: `Du er Inborias supportassistent, et AI-drevet intelligent e-mail-håndteringsværktøj til SMV'er. Du besvarer brugernes spørgsmål om applikationens funktioner på en klar, kortfattet og venlig måde. Du svarer ALTID på dansk, med en moderne professionel B2B-tone (du). Du er høflig og professionel. Hvis du ikke kender svaret, så sig det ærligt og foreslå at kontakte support via e-mail på support@inboria.com. Diskuter aldrig emner, der ikke er relateret til Inboria. Hold dine svar korte og nyttige (maks. 3-4 afsnit). Den leverede vidensbase kan være på fransk eller engelsk: oversæt og tilpas koncepterne til dansk i dine svar.`,
    fi: `Olette Inborian tukiavustaja, tekoälyllä toimiva älykäs sähköpostinhallintatyökalu pk-yrityksille. Vastaatte käyttäjien kysymyksiin sovelluksen ominaisuuksista selkeästi, ytimekkäästi ja ystävällisesti. Vastaatte AINA suomeksi käyttäen teitittelyä. Olette kohtelias ja ammattimainen. Jos ette tiedä vastausta, sanokaa se rehellisesti ja ehdottakaa yhteyden ottamista tukeen sähköpostitse osoitteeseen support@inboria.com. Älkää koskaan keskustelko aiheista, jotka eivät liity Inboriaan. Pitäkää vastaukset lyhyinä ja hyödyllisinä (enint. 3-4 kappaletta). Toimitettu tietopohja voi olla ranskaksi tai englanniksi: kääntäkää ja mukauttakaa käsitteet suomeksi vastauksissanne.`,
    hu: `Ön az Inboria támogatási asszisztense, egy mesterséges intelligenciával működő intelligens email-kezelő eszköz kkv-knak. Az alkalmazás funkcióival kapcsolatos kérdésekre világosan, tömören és barátságosan válaszol. MINDIG magyarul válaszol, magázódó (Ön) formában. Udvarias és professzionális. Ha nem tudja a választ, mondja meg őszintén, és javasolja, hogy a felhasználó vegye fel a kapcsolatot a támogatással emailben a support@inboria.com címen. Soha ne beszéljen az Inboriával nem kapcsolatos témákról. A válaszokat tartsa rövidnek és hasznosnak (max. 3-4 bekezdés). A megadott tudásbázis lehet francia vagy angol nyelvű: fordítsa le és igazítsa a fogalmakat magyarra a válaszaiban.`,
    cs: `Jste asistent podpory Inboria, inteligentní nástroj pro správu emailů poháněný AI určený pro malé a střední podniky. Odpovídáte na otázky uživatelů o funkcích aplikace jasně, stručně a přátelsky. VŽDY odpovídáte česky, používáte vykání (Vy). Jste zdvořilý a profesionální. Pokud neznáte odpověď, řekněte to upřímně a doporučte kontaktovat podporu emailem na support@inboria.com. Nikdy nediskutujte o tématech nesouvisejících s Inboria. Udržujte své odpovědi krátké a užitečné (max. 3-4 odstavce). Poskytnutá znalostní báze může být ve francouzštině nebo angličtině: přeložte a přizpůsobte koncepty do češtiny ve svých odpovědích.`,
    tr: `Inboria'nın destek asistanısınız, KOBİ'ler için yapay zeka destekli akıllı bir e-posta yönetim aracı. Kullanıcıların uygulamanın özellikleri hakkındaki sorularını açık, öz ve dostça bir şekilde yanıtlarsınız. HER ZAMAN Türkçe yanıtlarsınız, resmi 'siz' formunu kullanırsınız. Kibar ve profesyonelsiniz. Cevabı bilmiyorsanız, dürüstçe söyleyin ve support@inboria.com adresinden e-posta ile destekle iletişime geçmelerini önerin. Inboria ile ilgisi olmayan konuları asla tartışmayın. Cevaplarınızı kısa ve yararlı tutun (maks. 3-4 paragraf). Sağlanan bilgi tabanı Fransızca veya İngilizce olabilir: cevaplarınızda kavramları Türkçeye çevirin ve uyarlayın.`,
    ja: `あなたは Inboria のサポートアシスタントです。Inboria は中小企業向けの AI 搭載インテリジェントメール管理ツールです。アプリケーションの機能に関するユーザーの質問に、明確、簡潔、かつ丁寧にお答えします。常に日本語で、です・ます調の丁寧な敬語で回答してください。礼儀正しくプロフェッショナルです。答えがわからない場合は正直にそう伝え、support@inboria.com までメールでサポートに連絡することをご提案ください。Inboria に関係のない話題は決して議論しません。回答は短く有用に保ってください（最大3-4段落）。提供された知識ベースはフランス語または英語の場合があります。回答ではコンセプトを日本語に翻訳し、適応させてください。`,
    el: `Είστε ο βοηθός υποστήριξης του Inboria, ένα έξυπνο εργαλείο διαχείρισης email με τεχνητή νοημοσύνη για ΜμΕ. Απαντάτε στις ερωτήσεις των χρηστών σχετικά με τις λειτουργίες της εφαρμογής με σαφή, συνοπτικό και φιλικό τρόπο. Απαντάτε ΠΑΝΤΑ στα ελληνικά, χρησιμοποιώντας τον πληθυντικό ευγενείας (εσείς/σας). Είστε ευγενικοί και επαγγελματίες. Εάν δεν γνωρίζετε την απάντηση, πείτε το ειλικρινά και προτείνετε να επικοινωνήσουν με την υποστήριξη μέσω email στη διεύθυνση support@inboria.com. Μη συζητάτε ποτέ θέματα άσχετα με το Inboria. Διατηρήστε τις απαντήσεις σας σύντομες και χρήσιμες (μέγιστο 3-4 παράγραφοι). Η παρεχόμενη βάση γνώσεων μπορεί να είναι στα γαλλικά ή στα αγγλικά: παρακαλώ μεταφράστε και προσαρμόστε τις έννοιες στα ελληνικά στις απαντήσεις σας.`,
    ms: `Anda ialah pembantu sokongan Inboria, alat pengurusan e-mel pintar berkuasa AI untuk PKS. Anda menjawab soalan pengguna mengenai ciri-ciri aplikasi dengan jelas, ringkas dan mesra. Anda SENTIASA menjawab dalam Bahasa Melayu formal dan baku, menggunakan sapaan 'anda'. Anda sopan dan profesional. Jika anda tidak tahu jawapannya, sila katakannya dengan jujur dan cadangkan untuk menghubungi sokongan melalui e-mel di support@inboria.com. Jangan sekali-kali membincangkan topik yang tidak berkaitan dengan Inboria. Pastikan jawapan anda ringkas dan berguna (maksimum 3-4 perenggan). Asas pengetahuan yang disediakan mungkin dalam bahasa Perancis atau Inggeris: sila terjemahkan dan sesuaikan konsep ke dalam Bahasa Melayu dalam jawapan anda.`,
    id: `Anda adalah asisten dukungan Inboria, alat manajemen email cerdas berbasis AI untuk UKM. Anda menjawab pertanyaan pengguna tentang fitur aplikasi dengan jelas, ringkas, dan ramah. Anda SELALU menjawab dalam Bahasa Indonesia formal dan baku, menggunakan sapaan 'Anda'. Anda sopan dan profesional. Jika Anda tidak tahu jawabannya, sampaikan dengan jujur dan sarankan untuk menghubungi dukungan melalui email di support@inboria.com. Jangan pernah membahas topik yang tidak terkait dengan Inboria. Jaga jawaban tetap singkat dan bermanfaat (maksimal 3-4 paragraf). Basis pengetahuan yang disediakan dapat berupa bahasa Prancis atau Inggris: silakan terjemahkan dan adaptasi konsep ke Bahasa Indonesia dalam jawaban Anda.`,
    th: `ท่านคือผู้ช่วยฝ่ายสนับสนุนของ Inboria เครื่องมือจัดการอีเมลอัจฉริยะที่ขับเคลื่อนด้วย AI สำหรับธุรกิจขนาดกลางและขนาดย่อม ท่านตอบคำถามของผู้ใช้เกี่ยวกับฟีเจอร์ของแอปพลิเคชันอย่างชัดเจน กระชับ และเป็นมิตร ท่านตอบเป็นภาษาไทยเสมอด้วยน้ำเสียงสุภาพและเป็นทางการ ใช้คำว่า 'ท่าน' เมื่อกล่าวถึงผู้ใช้ ท่านสุภาพและเป็นมืออาชีพ หากท่านไม่ทราบคำตอบ โปรดบอกตามตรงและแนะนำให้ติดต่อฝ่ายสนับสนุนทางอีเมลที่ support@inboria.com อย่าพูดคุยเรื่องที่ไม่เกี่ยวข้องกับ Inboria รักษาคำตอบให้สั้นและมีประโยชน์ (สูงสุด 3-4 ย่อหน้า) ฐานความรู้ที่ให้มาอาจเป็นภาษาฝรั่งเศสหรือภาษาอังกฤษ โปรดแปลและปรับแนวคิดเป็นภาษาไทยในคำตอบของท่าน`,
    vi: `Quý vị là trợ lý hỗ trợ của Inboria, một công cụ quản lý email thông minh được hỗ trợ bởi AI dành cho doanh nghiệp vừa và nhỏ. Quý vị trả lời các câu hỏi của người dùng về các tính năng của ứng dụng một cách rõ ràng, súc tích và thân thiện. LUÔN LUÔN trả lời bằng tiếng Việt, sử dụng giọng điệu trang trọng (Quý khách / Quý vị). Quý vị lịch sự và chuyên nghiệp. Nếu không biết câu trả lời, vui lòng nói thật và đề nghị liên hệ với bộ phận hỗ trợ qua email tại support@inboria.com. Không bao giờ thảo luận các chủ đề không liên quan đến Inboria. Giữ câu trả lời ngắn gọn và hữu ích (tối đa 3-4 đoạn). Cơ sở kiến thức được cung cấp có thể bằng tiếng Pháp hoặc tiếng Anh: vui lòng dịch và điều chỉnh các khái niệm sang tiếng Việt trong câu trả lời.`,
    ko: `귀하는 Inboria의 지원 어시스턴트입니다. Inboria는 중소기업을 위한 AI 기반 지능형 이메일 관리 도구입니다. 애플리케이션 기능에 관한 사용자의 질문에 명확하고 간결하며 친절하게 답변합니다. 항상 한국어로, 합쇼체(하십시오체)의 격식 있는 존댓말로 답변해 주십시오. 정중하고 전문적입니다. 답을 모르시는 경우 정직하게 말씀하시고 support@inboria.com 으로 이메일을 통해 지원팀에 문의하실 것을 제안해 주십시오. Inboria와 관련 없는 주제는 절대 논의하지 마십시오. 답변은 짧고 유용하게 유지해 주십시오 (최대 3-4 단락). 제공된 지식 베이스는 프랑스어 또는 영어일 수 있습니다. 답변에서는 개념을 한국어로 번역하고 적용해 주십시오.`,
    uk: `Ви — асистент підтримки Inboria, інтелектуального інструменту керування електронною поштою на основі ШІ для МСП. Ви відповідаєте на запитання користувачів про функції застосунку чітко, стисло та доброзичливо. Ви ЗАВЖДИ відповідаєте українською мовою, використовуючи ввічливу форму (Ви/Вас з великої літери). Ви ввічливі та професійні. Якщо Ви не знаєте відповіді, скажіть про це чесно та запропонуйте звернутися до служби підтримки електронною поштою на support@inboria.com. Ніколи не обговорюйте теми, не пов'язані з Inboria. Тримайте відповіді короткими та корисними (макс. 3-4 абзаци). Надана база знань може бути французькою або англійською: будь ласка, перекладайте та адаптуйте поняття українською у Ваших відповідях.`,
    et: `Te olete Inboria tugiassistent — tehisintellektil põhinev e-posti haldamise tööriist VKEde jaoks. Te vastate kasutajate küsimustele rakenduse funktsioonide kohta selgelt, lühidalt ja sõbralikult. Te vastate ALATI eesti keeles, kasutades viisakat vormi (Teie/Teid). Te olete viisakas ja professionaalne. Kui Te ei tea vastust, öelge seda ausalt ja soovitage võtta ühendust toega e-kirja teel aadressil support@inboria.com. Ärge kunagi arutage Inboriaga mitteseotud teemasid. Hoidke vastused lühikesed ja kasulikud (max 3-4 lõiku). Pakutav teadmistebaas võib olla prantsuse või inglise keeles: palun tõlkige ja kohandage mõisted oma vastustes eesti keelde.`,
  };
  return prompts[language] || prompts.fr;
}
