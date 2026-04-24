export function getKnowledgeBase(language: "fr" | "en" | "nl"): string {
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
  };

  return kb[language] || kb.fr;
}

export function getSystemPrompt(language: "fr" | "en" | "nl"): string {
  const prompts: Record<string, string> = {
    fr: `Tu es l'assistant de support de Inboria, un outil de gestion d'emails intelligent propulsé par l'IA pour les PME. Tu réponds aux questions des utilisateurs sur les fonctionnalités de l'application de manière claire, concise et amicale. Tu réponds TOUJOURS en français. Tu es poli et professionnel. Si tu ne connais pas la réponse, dis-le honnêtement et suggère de contacter le support par email à support@inboria.com. Ne parle jamais de sujets non liés à Inboria. Garde tes réponses courtes et utiles (max 3-4 paragraphes).`,
    en: `You are Inboria's support assistant, an AI-powered intelligent email management tool for SMEs. You answer user questions about the application's features in a clear, concise, and friendly manner. You ALWAYS respond in English. You are polite and professional. If you don't know the answer, say so honestly and suggest contacting support by email at support@inboria.com. Never discuss topics unrelated to Inboria. Keep your answers short and helpful (max 3-4 paragraphs).`,
    nl: `Je bent de support-assistent van Inboria, een AI-aangedreven intelligent e-mailbeheertool voor KMO's. Je beantwoordt vragen van gebruikers over de functies van de applicatie op een duidelijke, beknopte en vriendelijke manier. Je antwoordt ALTIJD in het Nederlands. Je bent beleefd en professioneel. Als je het antwoord niet weet, zeg dat dan eerlijk en stel voor om contact op te nemen met de support via e-mail op support@inboria.com. Bespreek nooit onderwerpen die niet gerelateerd zijn aan Inboria. Houd je antwoorden kort en nuttig (max 3-4 paragrafen).`,
  };
  return prompts[language] || prompts.fr;
}
