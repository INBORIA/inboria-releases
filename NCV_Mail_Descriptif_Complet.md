# NCV Mail — Descriptif complet de l'application

**Version** : Avril 2026
**Type** : SaaS B2B — "Email Autopilot"
**Marché** : PME, indépendants et professionnels (Belgique / France)
**Langues** : Français, English, Nederlands (sélecteur dans l'interface)

---

## 1. Vue d'ensemble

NCV Mail est un autopilote email intelligent qui lit, trie, priorise et catégorise automatiquement les emails entrants grâce à l'IA. L'utilisateur retrouve sa boîte de réception déjà organisée chaque matin.

---

## 2. Architecture technique

| Couche | Technologie |
|---|---|
| Frontend web | React 19, Vite, TypeScript, Tailwind CSS, shadcn/ui, wouter |
| App mobile | Expo (React Native) — iOS & Android |
| Backend API | Express 5, Node.js |
| Base de données | Supabase (PostgreSQL) |
| Authentification | Supabase Auth (email + mot de passe) |
| Paiements | Stripe (Checkout, webhooks, portail client) |
| IA | OpenAI GPT-4o-mini (via proxy Replit AI Integration) |
| Intégrations | Gmail OAuth2, Outlook/Microsoft Graph, IMAP générique, Slack, Notion |
| Internationalisation | react-i18next — 3 langues (FR/EN/NL) |
| Design | Thème sombre exclusif (inspiré Linear/Superhuman), police Inter |

---

## 3. Site marketing (pages publiques)

### 3.1 Page d'accueil
- Présentation du concept "Autopilot" en 3 étapes : connecter sa boîte mail, créer ses catégories, l'IA gère le reste.
- Mise en avant des bénéfices : gain de temps, personnalisation, sécurité RGPD, vision claire des emails importants.
- Démo animée interactive.

### 3.2 Fonctionnalités
- Tri intelligent par IA
- Résumés automatiques des fils et newsletters
- Brouillons de réponse IA adaptés au ton de l'utilisateur
- Brief quotidien (bilan matinal)
- Extraction automatique de tâches depuis les emails
- Gestion de projets (regroupement par fils, pièces jointes, interlocuteurs)
- Multi-boîtes (Gmail, Outlook, iCloud, IMAP)
- Signatures professionnelles, archivage intelligent, détection de priorité
- App mobile iOS & Android

### 3.3 Intelligence artificielle
- Analyse sémantique, reconnaissance d'expéditeurs, traitement temps réel
- Processus transparent en 4 étapes : Réception → Analyse 3s → Actions auto → Validation utilisateur
- Engagements sécurité : aucune donnée utilisée pour entraîner les modèles, conformité RGPD, infrastructure chiffrée
- FAQ sur la confidentialité et le contrôle utilisateur

### 3.4 Classification (Packs Métiers)
- 56 packs pré-configurés répartis en 9 secteurs :
  - Services professionnels, Santé, Commerce, Immobilier, Services aux entreprises, Artisanat, Éducation, Hôtellerie-restauration, Autres
- Génération IA de packs personnalisés (6-12 catégories) sur description libre
- Fusion intelligente avec détection de doublons

### 3.5 Entreprise
- Boîtes partagées (ex : contact@), attribution d'emails, notes internes
- Rôles et permissions (Admin / Membre)
- Tableau de bord d'activité équipe

### 3.6 Tarifs
- **Essai** : 100 emails gratuits, sans carte bancaire
- **Solo** : Pour professionnels individuels
- **Pro** : Plan recommandé avec fonctionnalités avancées
- **Business** : Tarification par siège (à partir de 3 sièges), outils d'équipe complets
- Paiement sécurisé via Stripe, conformité RGPD

### 3.7 Pages légales
- Conditions générales d'utilisation
- Politique de confidentialité
- Mentions légales

---

## 4. Authentification et inscription

### 4.1 Inscription
- Formulaire : nom complet, email professionnel, pays (EU/EEE + Suisse), mot de passe avec indicateur de force
- Vérification email obligatoire (lien Supabase)
- Restriction géographique : uniquement pays EU/EEE + Suisse

### 4.2 Connexion
- Email + mot de passe
- Redirection automatique vers le dashboard ou un plan spécifique

### 4.3 Récupération de mot de passe
- Envoi de lien de réinitialisation par email
- Page dédiée pour définir un nouveau mot de passe

### 4.4 Invitation d'équipe
- Page spéciale pour rejoindre une organisation via lien d'invitation partagé

---

## 5. Dashboard — Boîte de réception (page principale)

### 5.1 Affichage des emails
- Liste d'emails avec barre de couleur gauche (priorité : rouge/urgent, ambre/moyen, vert/faible)
- Avatars circulaires, ligne de résumé IA (icône sparkles), badges catégorie et projet
- Barre de recherche + indicateur Autopilot + filtres par pastilles de priorité
- Badge "Assigné" pour les emails attribués à un membre
- Badge pièce jointe (trombone) avec compteur
- Pagination infinie par défilement (IntersectionObserver)

### 5.2 Filtrage et tri
- Par priorité (Toutes, Urgent, Moyen, Faible)
- Par catégorie
- Par projet
- Par boîte partagée
- Par statut de lecture
- Recherche textuelle

### 5.3 Détail d'un email
- Résumé IA, corps complet, fil de conversation
- Actions : archiver, supprimer, marquer lu/non-lu, changer priorité/catégorie/projet
- Répondre / Transférer avec brouillon IA
- Créer une tâche ou un suivi depuis l'email
- Pièces jointes : affichage, téléchargement, aperçu inline (images/PDF)
- Commentaires internes (notes d'équipe)
- Attribution à un membre de l'équipe

### 5.4 Actions groupées
- Sélection multiple pour archivage, changement de statut, mise à jour en lot

### 5.5 Triage IA (formulaire manuel)
- Soumettre un email (expéditeur, sujet, corps) pour classification IA
- L'IA retourne : catégorie, priorité, résumé
- La langue de l'utilisateur est transmise pour que l'IA génère dans la bonne langue

### 5.6 Reclassification automatique
- Bouton pour reclasser tous les emails "Non classé" via IA
- Respecte la langue de l'interface utilisateur

---

## 6. Dashboard — Bilan IA (Brief quotidien)

- Résumé personnalisé de l'état de la boîte de réception
- **Score de sérénité** : métrique visuelle 0-100 indiquant la santé de la boîte
- Emails urgents à traiter mis en avant
- Nouvelles tâches détectées par l'IA
- Conseil de productivité quotidien généré par l'IA

---

## 7. Dashboard — Emails envoyés

- Historique complet des emails sortants avec destinataire et projet
- Vue conversation (regroupement en fils)
- Résumé IA de conversation
- Création de suivi pour les messages nécessitant une réponse
- Export CSV des emails envoyés

---

## 8. Dashboard — Archives

- Emails archivés organisés par catégorie
- Restauration vers la boîte principale ou suppression définitive
- Accès aux résumés IA et métadonnées
- Catégorie "Non classé" avec clé spéciale (sentinel)

---

## 9. Dashboard — Suivi (Follow-ups)

- Tableau de bord des emails/tâches nécessitant un suivi
- Statuts : En attente, Relance, Terminé
- Détection IA automatique des emails nécessitant un suivi
- Indicateurs de retard
- Vue détaillée : fil de conversation complet, résumé IA, outils de réponse rapide, brouillon IA de relance
- Édition de notes
- Export CSV

---

## 10. Dashboard — Tâches

- Liste centralisée de toutes les tâches (extraites automatiquement des emails ou créées manuellement)
- Filtrage par statut : À faire, Fait, Toutes
- Lien rapide vers l'email d'origine avec résumé IA
- Métadonnées : date d'échéance, priorité, projet/expéditeur associé
- Export CSV

---

## 11. Dashboard — Projets

- Création et gestion de projets avec statut (Actif, En pause, Terminé) et code couleur
- Vue de tous les emails et tâches liés à un projet
- Notes persistantes par projet
- Tâches spécifiques au projet (créer, cocher, supprimer)
- Export CSV

---

## 12. Dashboard — Classification (Packs Métiers + Catégories)

### 12.1 Catégories personnalisées
- Créer, modifier, supprimer des catégories
- 27 catégories suggérées par l'IA avec création en un clic
- Statistiques d'utilisation (nombre d'emails par catégorie)
- Traduction automatique des noms de catégories selon la langue de l'interface

### 12.2 Packs Métiers
- 56 packs pré-configurés dans 9 familles de métiers
- Recherche par famille ou par mot-clé
- Génération IA de pack personnalisé sur description libre (6-12 catégories)
- Application d'un pack avec fusion intelligente (pas d'écrasement des catégories existantes)

---

## 13. Dashboard — Équipe (Plan Business)

### 13.1 Gestion d'organisation
- Création et gestion du nom de l'organisation
- Invitation de membres par email avec rôle (Admin / Membre)
- Gestion des invitations en attente (annuler / renvoyer)
- Changement de rôle ou suppression de membres
- Suivi de l'utilisation des sièges vs. plan actuel

### 13.2 Boîtes partagées
- Partage de boîtes connectées (ex : contact@, info@) avec l'équipe
- Gestion des membres et permissions (ex : "peut répondre")
- Workflow de réclamation (claim) d'emails pour éviter les doublons de traitement
- Synchronisation forcée manuelle

### 13.3 Activité d'équipe
- Statistiques par membre : emails assignés, archivés, commentés
- Journal d'activité (qui a fait quoi, quand)
- Compteurs globaux : total membres, emails assignés, activité de collaboration

---

## 14. Dashboard — Abonnement

- Comparaison des plans (Essai, Solo, Pro, Business) avec fonctionnalités détaillées
- Suivi de la consommation IA (emails traités vs. quota mensuel)
- Gestion des paiements via Stripe
- Accès au portail client Stripe (factures, moyens de paiement, annulation)
- Date de renouvellement

---

## 15. Dashboard — Paramètres

### 15.1 Connexions email
- Connexion Gmail (OAuth2)
- Connexion Outlook (OAuth2)
- Connexion IMAP générique (serveur, port, identifiants)
- Gestion de multiples comptes du même fournisseur (ex : 2 comptes Gmail)
- Déconnexion par compte

### 15.2 Préférences IA
- Activation/désactivation des fonctions IA :
  - Extraction automatique de tâches
  - Détection de projets
  - Détection de facturation urgente

### 15.3 Profil
- Mise à jour du nom
- Gestion des signatures email (avec aperçu)

### 15.4 Sécurité
- Changement de mot de passe

---

## 16. Dashboard — Manuel d'utilisation

- Guide catégorisé couvrant toutes les sections du dashboard
- Explication des fonctionnalités module par module
- Aide à l'onboarding des nouveaux utilisateurs

---

## 17. Fonctionnalités IA (Backend)

| Endpoint | Fonction |
|---|---|
| `POST /ai/triage` | Classification d'un email (catégorie, priorité, résumé) |
| `POST /ai/daily-summary` | Génération du bilan quotidien avec score de sérénité |
| `POST /ai/draft` | Brouillon de réponse contextuel et professionnel |
| `POST /ai/recategorize-uncategorized` | Reclassification en lot des emails non classés |
| `POST /ai/conversation-summary` | Résumé d'un fil de conversation complet |
| `POST /ai/detect-followups` | Détection des emails nécessitant un suivi |
| `POST /ai/generate-relance` | Génération de brouillon de relance |

- Toutes les fonctions IA acceptent un paramètre `lang` pour générer dans la langue de l'utilisateur (FR/EN/NL)
- Modèle utilisé : GPT-4o-mini
- Triage automatique pendant la synchronisation des emails

---

## 18. Synchronisation email

- **Auto-sync** : synchronisation automatique toutes les 5 minutes
- Fournisseurs supportés : Gmail, Outlook, IMAP générique
- Triage IA automatique à la réception
- Déduplication des emails
- Rafraîchissement automatique des tokens OAuth
- Extraction des pièces jointes (métadonnées stockées, contenu récupéré à la demande)

---

## 19. Envoi d'emails

- Envoi via Gmail (API), Outlook (Microsoft Graph), IMAP/SMTP (Nodemailer)
- Support du threading (réponses dans le même fil)
- Pièces jointes : upload, envoi multipart, nettoyage des fichiers temporaires
- Brouillon IA avant envoi

---

## 20. Pièces jointes

- Extraction automatique pendant la synchronisation (Gmail : attachmentId, IMAP : message UID)
- Téléchargement proxy à la demande (pas de stockage permanent)
- Upload pour envoi (multer + nettoyage automatique)
- Aperçu inline pour images et PDF
- Icônes par type de fichier, affichage de la taille

---

## 21. Commentaires internes

- Notes privées sur les fils d'emails (visibles par l'équipe uniquement)
- Créer, modifier, supprimer ses propres commentaires
- Raccourci Ctrl+Enter pour envoyer
- Contrôle d'accès : emails personnels + boîtes partagées + même organisation

---

## 22. Attribution d'emails

- Assigner un email à un membre de l'équipe (Plan Business)
- Badge "Assigné" visible dans la liste
- Désassignation par l'assigné, le propriétaire ou un admin
- Notifications automatiques à l'assigné

---

## 23. Notifications et journal d'activité

- Notifications automatiques sur : assignation d'email, nouveau commentaire
- Compteur de non-lus avec polling temps réel (30s)
- Marquer comme lu / Tout marquer comme lu
- Journal d'activité pour les organisations : assignations, commentaires

---

## 24. Export de données

| Type | Format |
|---|---|
| Emails (inbox, fil, par statut) | CSV |
| Projets | CSV |
| Suivis (follow-ups) | CSV |
| Tâches | CSV |

- Export authentifié via fetch + téléchargement blob

---

## 25. Intégrations tierces (Plan Pro+)

### 25.1 Slack
- Connexion OAuth2
- Envoi de notifications d'emails urgents vers un canal Slack configuré

### 25.2 Notion
- Connexion OAuth2
- Création de pages de tâches dans une base Notion depuis les tâches extraites par l'IA

---

## 26. Webhook (ingestion temps réel)

- `POST /api/webhook/email` : réception d'un email unique
- `POST /api/webhook/email/batch` : réception par lot
- Traitement IA automatique, détection de doublons

---

## 27. Stripe et facturation

- Checkout Sessions avec : taxe automatique, collecte d'ID TVA (B2B), adresse de facturation obligatoire
- Webhooks : `checkout.session.completed`, `invoice.paid`, `customer.subscription.deleted`, `customer.subscription.updated`
- Portail client Stripe (gestion autonome des factures et moyens de paiement)
- Devise : EUR, méthodes : carte + SEPA
- Création automatique d'organisation sur souscription Business
- Restriction géographique : EU/EEE + Suisse uniquement

---

## 28. Internationalisation (i18n)

- 3 langues : Français, English, Nederlands
- Sélecteur de langue dans le header marketing et le header dashboard
- Persistance du choix en localStorage
- Détection automatique de la langue du navigateur
- Traduction complète : pages marketing, dashboard, auth, composants partagés
- Catégories dynamiques traduites via utilitaire `translateCategoryName()`
- Prompts IA multilingues (résumés, catégories, tâches générés dans la langue choisie)
- 27 catégories suggérées traduites dans les 3 langues

---

## 29. Application mobile (Expo / React Native)

- Thème sombre exclusif
- Navigation par onglets : Réception, Bilan, Tâches, Projets, Menu
- Écrans : login, inscription, détail email, détail projet, archives, catégories, abonnement
- Partage des hooks API (`@workspace/api-client-react`) et de l'auth Supabase avec le web
- Compatible iOS et Android

---

## 30. Sécurité et conformité

- Authentification JWT validée côté serveur
- Conformité RGPD
- Aucune donnée email utilisée pour entraîner les modèles IA
- Infrastructure chiffrée
- Contrôle d'accès par propriétaire, organisation et rôle
- Bannière cookies avec gestion du consentement (accepter tout, essentiels, refuser, personnaliser)

---

## 31. Design system

| Élément | Valeur |
|---|---|
| Background | `#0d1117` |
| Cards | `#141c2b` |
| Bleu primaire | `#2d7dd2` |
| Texte muted | `#8b9cb3` |
| Bordures | `#1f2937` |
| Priorité urgente | Rouge |
| Priorité moyenne | Ambre |
| Priorité faible | Émeraude |
| Sidebar | 200px, items 12px, highlights subtils |
| Composants UI | 50+ primitives shadcn/ui (boutons, inputs, dialogs, tooltips, tables, etc.) |

---

*Document généré le 9 avril 2026 — NCV Mail v1.0*
