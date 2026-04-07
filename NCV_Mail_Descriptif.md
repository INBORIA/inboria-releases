# NCV Mail — Descriptif complet de l'application

## Présentation générale

**NCV Mail** est une plateforme SaaS B2B d'**Email Autopilot** destinée aux PME en Belgique et en France. L'application utilise l'intelligence artificielle pour trier, résumer et organiser automatiquement les emails professionnels selon les règles personnalisées de chaque utilisateur.

**Éditeur :** NCV Management SRL (Belgique)
**Domaine :** ncvmail.com
**Interface :** Entièrement en français, thème sombre

---

## Architecture technique

| Couche | Technologie |
|--------|-------------|
| **Frontend Web** | React + Vite + Tailwind CSS + Wouter (routeur) |
| **Frontend Mobile** | React Native + Expo SDK 54 + Expo Router |
| **Backend API** | Express.js (Node.js) |
| **Base de données** | Supabase (PostgreSQL) + Drizzle ORM |
| **Authentification** | Supabase Auth (GoTrue) |
| **IA** | OpenAI GPT-4o-mini |
| **Paiements** | Stripe (abonnements + portail client) |
| **Monorepo** | pnpm workspace |

### Bibliothèques partagées
- `api-spec` : Spécification OpenAPI
- `api-client-react` : Hooks React générés automatiquement (Orval)
- `api-zod` : Schémas de validation partagés
- `db` : Schéma Drizzle ORM et migrations
- `integrations-*` : Wrappers OpenAI et services tiers

---

## Site marketing (pages publiques)

### Page d'accueil (`/`)
- **Accroche principale :** "Votre inbox est déjà gérée quand vous arrivez le matin."
- **Sous-titre :** "NCV Mail — l'Email Autopilot."
- **Démo animée interactive** montrant le cycle complet :
  1. Réception des emails (arrivée un par un)
  2. Tri automatique par l'IA (classification par priorité + résumés)
  3. Sélection groupée des newsletters
  4. Suppression en masse
  5. Inbox propre avec statistiques
- **Comment ça marche (3 étapes) :** Connecter sa boîte → Créer ses catégories → L'IA gère en autopilot
- **Avantages :** Gain de temps, personnalisation totale, sécurité des données (chiffrement), vision claire des emails importants
- **CTA :** "Commencer gratuitement" (100 emails offerts)

### Fonctionnalités (`/fonctionnalites`)
Grille de 12 fonctionnalités détaillées :
1. Tri intelligent par priorité
2. Résumés automatiques par l'IA
3. Brouillons de réponse IA
4. Brief quotidien
5. Extraction automatique des tâches
6. Gestion de projets
7. Connexion multi-boîtes (Gmail, Outlook, IMAP)
8. Gestion de signature email
9. Archivage intelligent
10. Détection de priorité
11. Application mobile
12. Sécurité RGPD

### Tarifs (`/tarifs`)

| Plan | Prix | Quota | Cible |
|------|------|-------|-------|
| **Essai** | Gratuit | 100 emails (usage unique) | Découverte |
| **Solo** | 9 €/mois | 3 000 emails/mois | Indépendants |
| **Pro** | 19 €/mois | 10 000 emails/mois | Professionnels |
| **Business** | 9 €/siège/mois | 10 000 emails/siège/mois | Équipes (3-50 sièges) |

- Slider interactif pour le plan Business (3 à 50 sièges)
- Redirection vers Stripe Checkout pour les utilisateurs connectés
- Redirection vers l'inscription avec plan pré-sélectionné pour les visiteurs

### Pages légales
- **Mentions légales** (`/mentions-legales`) : Identité de l'éditeur, numéro BCE, contact
- **Conditions d'utilisation** (`/conditions`) : Description du service, obligations, propriété intellectuelle, droit belge
- **Politique de confidentialité** (`/confidentialite`) : Conformité RGPD, données collectées, conservation 30 jours après suppression, droits des utilisateurs

---

## Authentification

### Inscription (`/signup`)
- Formulaire : nom complet, email, mot de passe
- Indicateur de force du mot de passe en temps réel
- Vérification email obligatoire (redirection vers `/verifier-email`)
- Conservation du plan sélectionné en `localStorage` pour reprise après vérification

### Connexion (`/login`)
- Email + mot de passe
- Redirection automatique vers l'abonnement si un plan est spécifié dans l'URL
- Sinon, redirection vers le dashboard

### Mot de passe oublié (`/mot-de-passe-oublie`)
- Saisie de l'email → envoi d'un lien de réinitialisation via Supabase
- Page de réinitialisation (`/reset-password`) pour définir un nouveau mot de passe

---

## Dashboard (application web)

Le dashboard utilise une **sidebar de navigation** avec :
- Indicateur de quota IA (consommation / limite)
- Profil utilisateur avec plan actif
- Navigation vers toutes les sections

### 1. Boîte de réception (Inbox)
- **Tri IA automatique** par priorité : Urgent (rouge), Moyen (ambre), Faible (vert)
- **Résumés IA** affichés directement dans la liste
- **Filtres** par priorité et par catégorie
- **Recherche** textuelle
- **Sélection multiple :**
  - Clic sur l'avatar pour sélectionner
  - Barre d'actions groupées : Tout sélectionner, Marquer lu, Archiver, Supprimer
- **Simulation d'emails** pour tester le triage IA
- **Badges intelligents :** catégorie, projet, statut "Nouveau"

### 2. Détail d'un email
- **Résumé IA** mis en évidence en haut
- **Corps de l'email** nettoyé et affiché de manière sécurisée
- **Réponse IA :** Génération automatique d'un brouillon de réponse basé sur le contexte
- **Triage manuel :** Dropdowns pour modifier priorité, catégorie, projet
- **Actions :** Répondre (manuel), Marquer lu, Archiver, Supprimer
- **Interface de réponse intégrée** (envoi direct sans quitter la vue)
- **Bouton retour** sticky en haut et en bas

### 3. Archives
- Organisation par **dossiers de catégories IA**
- Restauration d'emails vers l'inbox
- Même vue détaillée que l'inbox (modification de priorité/projet possible)

### 4. Bilan quotidien
- **Score de sérénité** (0-100) : indicateur de contrôle de l'inbox
- **Résumé en langage naturel** de la journée
- **Emails clés** nécessitant une attention immédiate
- **Statistiques rapides** : urgences, tâches extraites
- **Conseil du jour** : recommandation IA de productivité

### 5. Tâches
- **Extraction automatique** depuis les emails (l'IA détecte les demandes et deadlines)
- **Gestion de statut :** À faire / Terminée
- **Contexte :** date d'échéance + lien vers l'email source
- **Filtres :** En cours, Terminées, Toutes

### 6. Projets
- **Création** avec référence unique (ex: PROJ-001) et couleur personnalisée
- **Vue détaillée** : tous les emails et tâches associés au projet
- **Statuts :** Actif, En pause, Terminé
- **Compteurs** d'emails et tâches par projet

### 7. Catégories
- **Gestion des dossiers** de classification avec descriptions pour guider l'IA
- **Catégories suggérées** : Facturation, Support client, Juridique, etc.
- **Statistiques** : nombre d'emails classifiés par catégorie

### 8. Paramètres
- **Connexion email :** OAuth pour Gmail et Outlook + IMAP standard
- **Santé de la boîte (Inbox Health) :** statut de synchronisation, dernière synchro
- **Préférences IA :** toggles pour facturation urgente, extraction de tâches, détection de projets
- **Signature email** personnalisée (utilisée par l'IA pour les brouillons)
- **Profil :** informations utilisateur et sécurité

### 9. Abonnement
- **Suivi d'utilisation** en temps réel (barre de progression quota IA)
- **Sélection de plan** : Solo, Pro, Business (avec gestion du nombre de sièges)
- **Intégration Stripe :** accès au portail client pour gérer moyens de paiement et factures

---

## Application mobile (Expo / React Native)

L'app mobile est un **compagnon optimisé** de la version web, avec une navigation par onglets en bas d'écran.

### Onglets principaux

| Onglet | Fonctionnalité |
|--------|---------------|
| **Réception** | Inbox avec filtres, recherche, résumés de priorité, sélection multiple (long-press) |
| **Bilan** | Score de sérénité, résumé IA, conseils du jour, stats rapides |
| **Tâches** | Liste des tâches extraites, filtres, feedback haptique à la complétion |
| **Projets** | Vue des projets avec statut, compteurs emails/tâches |
| **Menu** | Profil, quota, navigation vers Archives, Catégories, Paramètres |

### Fonctionnalités spécifiques mobile
- **Sélection multiple** : appui long pour entrer en mode sélection → barre d'actions (Lu, Archiver, Supprimer) avec confirmation native pour la suppression
- **Retour haptique** (vibration) lors de la complétion de tâches et du triage
- **Notifications push** : alertes pour emails urgents et brief quotidien
- **Pull-to-refresh** sur toutes les listes
- **Vue détaillée email :** résumé IA, génération de brouillon IA, triage rapide, corps nettoyé

### Différences avec la version web
- **Configuration en lecture seule :** les connexions email (OAuth) et changements de plan se font exclusivement sur le web
- **Navigation native** avec transitions fluides (Stack/Tabs)
- **Composants natifs** (View, Text, Pressable) au lieu des composants Radix UI du web
- **Design system cohérent** : police Inter, palette de couleurs personnalisée, thème sombre identique

---

## API Backend

### Routes principales

| Module | Endpoints | Description |
|--------|-----------|-------------|
| `/auth` | Login, Register | Proxy vers Supabase Auth |
| `/emails` | CRUD, Bulk actions, Send | Gestion des emails, actions groupées (archive/read/delete), envoi SMTP/Graph/Gmail |
| `/email-connect` | OAuth Gmail/Outlook, IMAP | Flux OAuth, configuration IMAP, déclenchement de synchro manuelle |
| `/ai` | Triage, Daily Summary, Draft, Recategorize | Analyse IA d'emails, résumé quotidien, brouillons, réorganisation |
| `/tasks` | CRUD | Gestion des tâches |
| `/projects` | CRUD | Gestion des projets |
| `/categories` | CRUD | Gestion des catégories |
| `/stripe` | Checkout, Portal | Création de session Stripe, accès portail client |
| `/dashboard` | Summary, Category Counts, Inbox Health | Métriques et statistiques |

### Fonctionnalités IA
- **Triage automatique :** classification par priorité (urgent/moyen/faible), catégorisation, résumé en une phrase
- **Extraction de tâches :** détection des demandes et deadlines dans le contenu des emails
- **Brouillons de réponse :** génération contextuelle basée sur le profil utilisateur et ses projets
- **Bilan quotidien :** analyse globale avec score de sérénité et conseils
- **Apprentissage de règles :** si l'utilisateur corrige une priorité, l'IA crée une règle pour cet expéditeur

### Synchronisation automatique
- **Auto-sync** : vérification automatique toutes les 5 minutes pour les nouvelles connexions
- **Sync manuelle** disponible depuis les paramètres

---

## Base de données (Supabase / PostgreSQL)

### Tables principales

| Table | Contenu |
|-------|---------|
| `users` / `profiles` | Plan, quota, préférences IA, langue |
| `emails` | Métadonnées, résumé IA, priorité, statut, catégorie, projet |
| `categories` | Dossiers de classification par utilisateur |
| `tasks` | Tâches liées à un utilisateur et optionnellement à un email |
| `projects` | Groupes de travail avec référence unique |
| `email_connections` | Identifiants chiffrés et tokens de synchronisation |
| `ai_rules` | Règles apprises (ex: expéditeur → priorité forcée) |

---

## Intégrations tierces

| Service | Usage |
|---------|-------|
| **OpenAI** (GPT-4o-mini) | Triage, résumés, brouillons, extraction de tâches, bilan quotidien |
| **Stripe** | Abonnements, facturation, portail client |
| **Google** | OAuth Gmail + API Gmail pour accès aux emails |
| **Microsoft** | OAuth Outlook + Microsoft Graph API |
| **Supabase** | Base de données, authentification, stockage |

---

## Sécurité et conformité

- **RGPD :** politique de confidentialité complète, conservation limitée à 30 jours après suppression
- **Chiffrement** des identifiants de connexion email
- **Authentification sécurisée** via Supabase (sessions, tokens)
- **Droit belge** applicable
- **Sanitisation** des IDs dans les actions groupées (dédoublonnage, parseInt, max 500)
