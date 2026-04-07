# NCV Mail — Plan complet : Couche Organisation & Collaboration (V2 Business)

## Contexte actuel

Aujourd'hui, chaque utilisateur NCV Mail est **isolé** :
- Un compte = un profil = une boîte = ses catégories/tâches/projets
- Aucun concept d'entreprise, d'équipe ou de lien entre utilisateurs
- Le plan Business sur la page Tarifs promet "boîtes partagées" et "assignation de tâches", mais ces fonctionnalités n'existent pas encore
- La facturation Stripe est liée à un profil individuel

---

## Phase 1 — Fondations : Organisation & Invitations

### 1.1 Nouvelles tables en base de données

```
organisations
├── id              (uuid, PK)
├── name            (text) — "Dupont & Associés SPRL"
├── slug            (text, unique) — "dupont-associes"
├── plan            (text) — "business"
├── seats_total     (integer) — nombre de sièges achetés (min 3)
├── stripe_customer_id    (text)
├── stripe_subscription_id (text)
├── created_at      (timestamptz)
└── updated_at      (timestamptz)

organisation_members
├── id              (uuid, PK)
├── organisation_id (uuid, FK → organisations.id)
├── user_id         (uuid, FK → profiles.id)
├── role            (text) — "admin" | "member"
├── joined_at       (timestamptz)
└── status          (text) — "active" | "invited" | "disabled"

invitations
├── id              (uuid, PK)
├── organisation_id (uuid, FK → organisations.id)
├── email           (text) — adresse invitée
├── invited_by      (uuid, FK → profiles.id)
├── role            (text) — "admin" | "member"
├── token           (text, unique) — token sécurisé pour le lien
├── status          (text) — "pending" | "accepted" | "expired"
├── created_at      (timestamptz)
└── expires_at      (timestamptz)
```

### 1.2 Modifications au profil existant

Ajouter à la table `profiles` :
```
organisation_id     (uuid, nullable, FK → organisations.id)
```

Un utilisateur avec un `organisation_id` fait partie d'une équipe.
Un utilisateur sans `organisation_id` est en mode individuel (Solo/Pro/Essai).

### 1.3 Flux d'inscription Business

1. L'utilisateur choisit le plan Business sur `/tarifs` (3+ sièges)
2. Il s'inscrit normalement (email + mot de passe)
3. Après paiement Stripe, le système :
   - Crée une `organisation` avec le nom de l'entreprise
   - Lie le profil utilisateur à l'organisation avec rôle "admin"
   - Enregistre le Stripe customer/subscription sur l'organisation (pas sur le profil)
4. L'admin arrive sur son dashboard avec une nouvelle section "Mon équipe"

### 1.4 Système d'invitation

**Côté Admin (Dashboard > Mon équipe) :**
- Champ "Inviter un collègue" : saisir l'adresse email
- Vérification que le nombre de membres < seats_total
- Envoi d'un email d'invitation avec un lien sécurisé (token)
- Liste des membres actuels avec rôles et statuts
- Possibilité de retirer un membre ou changer son rôle

**Côté Invité :**
- Reçoit un email "Sophie Dubois vous invite à rejoindre Dupont & Associés sur NCV Mail"
- Clique le lien → page d'inscription pré-remplie (ou connexion si déjà inscrit)
- Son profil est automatiquement rattaché à l'organisation
- Il hérite du plan Business et du quota de l'organisation

### 1.5 Facturation centralisée

- La facturation Stripe passe de `profiles` à `organisations` pour le plan Business
- L'admin gère le nombre de sièges via le portail Stripe
- Le webhook `customer.subscription.updated` met à jour `seats_total` sur l'organisation
- Le quota est partagé : `seats × 10 000 emails/mois` pour toute l'organisation
- Compteur `emails_used` sur l'organisation (pas sur chaque profil individuel)

### 1.6 API : Nouvelles routes

```
POST   /api/organisations                   — Créer une organisation
GET    /api/organisations/mine              — Mon organisation
GET    /api/organisations/members           — Liste des membres
POST   /api/organisations/invite            — Inviter un collègue
DELETE /api/organisations/members/:id       — Retirer un membre
PATCH  /api/organisations/members/:id/role  — Changer un rôle
GET    /api/invitations/:token              — Vérifier une invitation
POST   /api/invitations/:token/accept       — Accepter une invitation
```

### 1.7 Middleware d'autorisation

Nouveau middleware `requireOrgRole("admin")` pour les routes sensibles :
- Seuls les admins peuvent inviter/retirer des membres
- Seuls les admins accèdent au portail Stripe
- Tous les membres accèdent aux fonctionnalités collaboratives

---

## Phase 2 — Boîtes mail partagées

### 2.1 Nouvelle table

```
shared_mailboxes
├── id              (uuid, PK)
├── organisation_id (uuid, FK → organisations.id)
├── name            (text) — "Support", "Commercial", "Info"
├── email_address   (text) — "info@dupont.be"
├── connection_id   (uuid, FK → email_connections.id)
├── created_at      (timestamptz)

shared_mailbox_members
├── id              (uuid, PK)
├── shared_mailbox_id (uuid, FK → shared_mailboxes.id)
├── user_id         (uuid, FK → profiles.id)
├── can_reply       (boolean, default true)
└── added_at        (timestamptz)
```

### 2.2 Fonctionnement

- L'admin connecte une adresse partagée (ex: info@dupont.be) via OAuth/IMAP
- Il assigne les membres qui y ont accès
- Les emails reçus sur cette adresse apparaissent dans une section "Boîtes partagées" du dashboard de chaque membre assigné
- L'IA trie ces emails comme les autres (priorité, catégorie, résumé)
- Quand un membre ouvre un email partagé, il peut le "prendre en charge"

### 2.3 Prise en charge

Ajouter aux emails partagés :
```
claimed_by          (uuid, nullable, FK → profiles.id)
claimed_at          (timestamptz, nullable)
```

- Quand un membre clique "Je m'en occupe", l'email est marqué à son nom
- Les autres voient "Pris en charge par Marc" et l'email est grisé dans leur liste
- Évite les doublons de réponse

---

## Phase 3 — Commentaires internes

### 3.1 Nouvelle table

```
email_comments
├── id              (uuid, PK)
├── email_id        (integer, FK → emails.id)
├── user_id         (uuid, FK → profiles.id)
├── content         (text) — "J'ai appelé, il confirme pour vendredi"
├── created_at      (timestamptz)
```

### 3.2 Fonctionnement

- Dans la vue détaillée d'un email, section "Notes d'équipe" en bas
- Chaque membre de l'organisation peut ajouter un commentaire
- Les commentaires sont visibles uniquement par les membres de l'organisation (jamais envoyés au client)
- Notification optionnelle aux collègues quand un commentaire est ajouté
- Affichage du nom + avatar + horodatage pour chaque commentaire

### 3.3 Règles d'accès

- Commentaires visibles uniquement par les membres de la même organisation
- Les utilisateurs Solo/Pro ne voient pas cette section
- Les commentaires sont liés à l'email, pas à un utilisateur spécifique

---

## Phase 4 — Assignation d'emails et tâches

### 4.1 Modifications aux tables existantes

Ajouter à la table `emails` :
```
assigned_to         (uuid, nullable, FK → profiles.id)
assigned_by         (uuid, nullable, FK → profiles.id)
assigned_at         (timestamptz, nullable)
```

Ajouter à la table `tasks` :
```
assigned_to         (uuid, nullable, FK → profiles.id)
assigned_by         (uuid, nullable, FK → profiles.id)
```

### 4.2 Fonctionnement

**Assignation d'emails :**
- Bouton "Assigner à..." dans la vue détaillée d'un email
- Dropdown avec la liste des membres de l'organisation
- L'email apparaît dans la boîte du collègue avec un badge "Assigné par Sophie"
- L'assigneur peut ajouter un commentaire en même temps ("Peux-tu gérer ce devis ?")
- Notification push mobile au collègue assigné

**Assignation de tâches :**
- Même mécanisme dans la vue Tâches
- On peut créer une tâche et l'assigner directement à un collègue
- Le collègue la voit dans ses tâches avec le contexte (email source, projet)

### 4.3 Filtres Dashboard

Nouveaux filtres dans l'inbox et les tâches :
- "Mes emails" / "Assignés à moi" / "Assignés par moi" / "Tous (équipe)"
- "Mes tâches" / "Assignées à moi" / "Toutes (équipe)"

---

## Phase 5 — Interface utilisateur

### 5.1 Dashboard Web — Nouvelles sections

**Sidebar :**
- Nouvelle section "Équipe" (visible uniquement pour les membres Business)
- Sous-menu : Mon équipe, Boîtes partagées

**Page "Mon équipe" (`/dashboard/equipe`) :**
- Liste des membres avec nom, email, rôle, statut
- Formulaire d'invitation
- Gestion des rôles (admin seulement)
- Compteur de sièges : "4/5 sièges utilisés"

**Page "Boîtes partagées" (`/dashboard/boites-partagees`) :**
- Liste des boîtes partagées avec dernière activité
- Clic → vue inbox filtrée sur cette boîte
- Indicateur de prise en charge

### 5.2 App Mobile — Adaptations

- Nouvel onglet ou section "Équipe" dans le menu
- Vue des membres (lecture seule, pas d'invitation depuis mobile)
- Badge "Assigné par X" sur les emails/tâches dans les listes
- Section commentaires dans la vue détaillée email
- Notification push pour : invitation, assignation, commentaire

---

## Ordre d'implémentation recommandé

| Étape | Description | Complexité | Dépendances |
|-------|-------------|-----------|-------------|
| **1.1** | Tables organisations + members + invitations | Moyenne | Aucune |
| **1.2** | Modifier profiles (ajouter organisation_id) | Faible | 1.1 |
| **1.3** | Routes API organisation (CRUD, invite, accept) | Moyenne | 1.1, 1.2 |
| **1.4** | Page "Mon équipe" dans le dashboard web | Moyenne | 1.3 |
| **1.5** | Adapter la facturation Stripe pour organisations | Haute | 1.1, 1.3 |
| **1.6** | Flux d'inscription Business (création org + paiement) | Moyenne | 1.5 |
| **1.7** | Système d'invitation par email | Moyenne | 1.3 |
| **2.1** | Tables boîtes partagées | Faible | 1.1 |
| **2.2** | Connexion d'une boîte partagée + prise en charge | Haute | 2.1 |
| **2.3** | Page "Boîtes partagées" dashboard | Moyenne | 2.2 |
| **3.1** | Table commentaires + API | Faible | 1.1 |
| **3.2** | UI commentaires dans le détail email (web + mobile) | Moyenne | 3.1 |
| **4.1** | Assignation emails/tâches (colonnes + API) | Moyenne | 1.1 |
| **4.2** | UI assignation (web + mobile) | Moyenne | 4.1 |
| **4.3** | Filtres équipe dans l'inbox | Faible | 4.1 |
| **5.1** | Adaptations mobile (équipe, commentaires, badges) | Moyenne | 3.2, 4.2 |

---

## Résumé des livrables

| Phase | Livrable | Valeur métier |
|-------|----------|---------------|
| **Phase 1** | Organisations, invitations, facturation centralisée | Les équipes peuvent s'inscrire et être facturées ensemble |
| **Phase 2** | Boîtes partagées avec prise en charge | Plus de doublons sur info@, support@ |
| **Phase 3** | Commentaires internes | Communication d'équipe sans quitter NCV Mail |
| **Phase 4** | Assignation emails + tâches | Délégation claire, rien ne tombe entre les mailles |
| **Phase 5** | Interfaces web + mobile | Expérience complète sur tous les appareils |

---

## Sécurité & Isolation des données

- **Row Level Security (RLS)** : chaque requête filtre par `user_id` ET `organisation_id`
- Les membres d'une organisation ne voient que les données de leur organisation
- Les utilisateurs Solo/Pro ne voient aucune donnée d'organisation
- Les emails personnels restent privés ; seuls les emails des boîtes partagées sont visibles par l'équipe
- L'admin ne peut pas lire les emails personnels de ses membres
- Les commentaires internes ne sortent jamais de l'organisation
