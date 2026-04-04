# Prompt de Reprise — NCV Mail sur Replit (FINAL & COMPLET)

> Copie-colle ce texte intégral dans ton assistant IA (Manus, Cursor, Replit AI, etc.) pour reprendre le développement sans rien perdre.

---

## Contexte du projet

Tu es mon assistant technique pour le projet **NCV Mail** — une application SaaS B2B de gestion d'emails par IA. Voici tout le contexte pour démarrer sans poser de questions inutiles.

**NCV Mail** est un "Email Autopilot" : l'IA lit, trie, priorise et classe automatiquement les emails de l'utilisateur selon ses propres règles. L'inbox est déjà gérée quand l'utilisateur arrive le matin.

- **Cible :** PME, indépendants, professions libérales (Belgique / France)
- **Marque mère :** NCV Management
- **Email de contact :** contact@ncvmail.com

---

## Stack technique complète et définitive

| Composant | Outil | URL / Détail |
|---|---|---|
| **Site vitrine** | Hostinger Horizons | https://ncvmail.com |
| **Application dashboard** | Replit | https://replit.com (à déployer sur app.ncvmail.com) |
| **Base de données + Auth** | Supabase (PostgreSQL) | https://ecdwevvisbrcsomdiqop.supabase.co |
| **IA de triage** | OpenAI API GPT-4o-mini | Clé à configurer dans les secrets Replit |
| **Automatisation email** | Make.com | Scénarios à créer (voir Étape 3) |
| **Paiement** | Stripe | Clé à configurer dans les secrets Replit |
| **Domaine** | ncvmail.com (Hostinger DNS) | app.ncvmail.com → Replit |

---

## Charte graphique (à respecter strictement)

| Élément | Valeur |
|---|---|
| Header / Sidebar / Hero | Bleu foncé `#1A3A5C` |
| Boutons CTA principaux | Bleu vif `#1877F2` |
| Fond principal | Blanc `#FFFFFF` |
| Fond secondaire (zones grises) | Gris très clair `#F8FAFC` |
| Texte principal | `#2C3E50` |
| Texte sur fond sombre | `#FFFFFF` |
| Priorité Urgente (badge) | Rouge `#EF4444` |
| Priorité Moyenne (badge) | Orange `#F59E0B` |
| Priorité Faible (badge) | Vert `#10B981` |
| Police | Inter (Google Fonts) |
| Rayon des boutons | 8px |
| Ombre des cartes | `0 1px 3px rgba(0,0,0,0.1)` |

---

## Supabase — Configuration existante

- **Project ID :** `ecdwevvisbrcsomdiqop`
- **URL :** `https://ecdwevvisbrcsomdiqop.supabase.co`
- **Clé Publishable :** `sb_publishable_x81ej2Xt29ywSavcKjbX-g_cjhhOV_s`
- **Clé Secret :** `sb_secret_xWKycGTZZHc1xGbYBqRnpg_ZgVp5ivF`

### Tables déjà créées dans Supabase

**Table `categories`**
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
created_at  timestamptz DEFAULT now()
user_id     uuid REFERENCES auth.users(id)
name        text NOT NULL
description text
```
RLS activé — chaque utilisateur voit uniquement ses propres catégories.

**Table `emails`**
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
created_at  timestamptz DEFAULT now()
user_id     uuid REFERENCES auth.users(id)
category_id uuid REFERENCES categories(id)
sender      text
subject     text
body        text
status      text DEFAULT 'classé'
priority    text DEFAULT 'moyen'
summary     text
```
RLS activé — chaque utilisateur voit uniquement ses propres emails.

### Tables à créer dans Supabase (à faire au démarrage)

**Table `profiles`** (profil utilisateur + plan d'abonnement)
```sql
id              uuid PRIMARY KEY REFERENCES auth.users(id)
created_at      timestamptz DEFAULT now()
full_name       text
plan            text DEFAULT 'gratuit'  -- 'gratuit', 'solo', 'pro', 'business'
seats           integer DEFAULT 1       -- nombre de sièges (plan Business)
emails_used     integer DEFAULT 0       -- emails traités ce mois
emails_quota    integer DEFAULT 50      -- quota selon le plan
stripe_customer_id text
stripe_subscription_id text
billing_period_start timestamptz DEFAULT now()
```

**Table `tasks`** (tâches extraites par l'IA)
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
created_at  timestamptz DEFAULT now()
user_id     uuid REFERENCES auth.users(id)
email_id    uuid REFERENCES emails(id)
title       text NOT NULL
done        boolean DEFAULT false
due_date    date
```

---

## Grille tarifaire finale

| Plan | Prix | Emails inclus/mois | Dépassement |
|---|---|---|---|
| **Gratuit** | 0 €/mois | 50 emails | Non disponible |
| **Solo** | 9 €/mois | 3 000 emails | 0,002 €/email |
| **Pro** | 19 €/mois | 10 000 emails | 0,001 €/email |
| **Business** | 9 €/siège/mois | 10 000 emails/siège | 0,001 €/email |

Le plan Business est 100 % libre-service : l'utilisateur choisit lui-même le nombre de sièges (1, 2, 3, 10...) sans contacter NCV Mail. Exemple affiché : "3 collaborateurs = 27 €/mois — modifiable à tout moment."

---

## Architecture de l'application Replit

L'application est un **React + TypeScript + Vite** avec les dépendances suivantes :
- `@supabase/supabase-js` — connexion Supabase
- `react-router-dom` — navigation
- `tailwindcss` — styles
- `lucide-react` — icônes
- `stripe` / `@stripe/stripe-js` — paiement

### Variables d'environnement à configurer dans Replit Secrets

```
VITE_SUPABASE_URL=https://ecdwevvisbrcsomdiqop.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_x81ej2Xt29ywSavcKjbX-g_cjhhOV_s
SUPABASE_SECRET_KEY=sb_secret_xWKycGTZZHc1xGbYBqRnpg_ZgVp5ivF
VITE_STRIPE_PUBLISHABLE_KEY=(à récupérer dans Stripe Dashboard)
STRIPE_SECRET_KEY=(à récupérer dans Stripe Dashboard)
OPENAI_API_KEY=(à récupérer dans OpenAI Platform)
```

---

## Pages et fonctionnalités à développer

### Page 1 — Authentification (`/login` et `/signup`)
- Formulaire email + mot de passe
- Connexion via Supabase Auth (`supabase.auth.signInWithPassword`)
- Inscription via Supabase Auth (`supabase.auth.signUp`)
- Lien "Mot de passe oublié" (`supabase.auth.resetPasswordForEmail`)
- Après connexion → redirection vers `/dashboard`
- Logo NCV Mail en haut + fond bleu foncé `#1A3A5C`
- Lien vers ncvmail.com (retour au site vitrine)

### Page 2 — Dashboard principal (`/dashboard`)
Structure :
- **Sidebar gauche (260px fixe)** :
  - Logo NCV Mail en haut
  - Navigation : Boîte prioritaire, Bilan quotidien, Tâches, Catégories, Paramètres, Abonnement
  - En bas : nom de l'utilisateur + plan actuel + barre de quota (emails utilisés / quota)
  - Bouton "Se déconnecter"
- **Zone principale** :
  - Header : titre de la page courante + bouton "Connecter ma boîte mail" si non connecté
  - Bannière d'alerte si boîte non connectée : "Aucune boîte connectée — Connectez Gmail ou Outlook pour commencer"
  - **Boîte prioritaire** : liste des emails triés avec badge priorité (Urgent/Moyen/Faible), expéditeur, sujet, résumé IA, catégorie, heure
  - Filtre par priorité (Toutes / Urgent / Moyen / Faible)
  - Boutons sur chaque email : "Ouvrir" + "Changer de catégorie"
- **Colonne droite (280px)** :
  - Santé de l'inbox (score 0-100 + barre de progression)
  - Catégories avec compteur d'emails non lus

### Page 3 — Bilan quotidien (`/dashboard/bilan`)
- Score de santé de l'inbox (0-100)
- Résumé IA de la journée (texte généré par OpenAI)
- Emails clés à traiter (liste des 5 plus importants)
- Emails en attente de réponse
- Statistiques : total emails, urgent, moyen, faible, en attente
- Conseil IA personnalisé
- Bouton "Régénérer le bilan"
- Langue configurable (français par défaut)

### Page 4 — Tâches (`/dashboard/taches`)
- Liste des tâches extraites automatiquement par l'IA depuis les emails
- Pour chaque tâche : titre, email source (lien), date d'échéance si détectée, checkbox "Marquer comme fait"
- Filtre : Toutes / En cours / Terminées
- Compteur de tâches en attente

### Page 5 — Catégories (`/dashboard/categories`)
- Liste des catégories avec nombre d'emails par catégorie
- Créer une nouvelle catégorie (nom + description)
- Modifier une catégorie existante
- Supprimer une catégorie (avec confirmation)
- Catégories par défaut suggérées : Finance, Clients, RH, Marketing, Administratif

### Page 6 — Paramètres (`/dashboard/parametres`)
- **Section "Boîte mail"** : bouton "Connecter Gmail" (OAuth Google), bouton "Connecter Outlook" (OAuth Microsoft), statut de connexion
- **Section "Préférences IA"** : langue du bilan (FR/EN), sensibilité de priorité (Normal / Strict / Détendu)
- **Section "Compte"** : nom complet, email, changer de mot de passe
- **Section "Notifications"** : activer/désactiver le bilan quotidien par email

### Page 7 — Abonnement (`/dashboard/abonnement`)
- Affichage du plan actuel avec quota utilisé (barre de progression)
- 4 cartes tarifaires : Gratuit / Solo / Pro / Business
- Bouton "Choisir ce plan" sur chaque carte (intégration Stripe Checkout)
- Plan Business : sélecteur de nombre de sièges (1 à 50) avec calcul du prix en temps réel
- Historique de facturation
- Note : "Sans engagement — modifiable à tout moment"

---

## Étape 3 — Make.com : Automatisation IA (à configurer séparément)

Scénario Make.com à créer :
1. **Déclencheur :** Nouvel email reçu (Gmail Watch ou Outlook Watch)
2. **Action 1 :** Récupérer les catégories de l'utilisateur depuis Supabase (GET /categories?user_id=...)
3. **Action 2 :** Appel OpenAI GPT-4o-mini avec ce prompt :
   ```
   Tu es un assistant de gestion d'emails. Voici un email :
   Expéditeur : {sender}
   Sujet : {subject}
   Corps : {body}
   
   Catégories disponibles : {liste des catégories}
   
   Réponds en JSON avec :
   {
     "category": "nom exact de la catégorie",
     "priority": "urgent" | "moyen" | "faible",
     "summary": "résumé en 1 phrase",
     "tasks": ["tâche 1", "tâche 2"] // si des actions sont requises
   }
   ```
4. **Action 3 :** Insérer dans Supabase table `emails` (sender, subject, body, category_id, priority, summary, user_id)
5. **Action 4 :** Si tasks non vide → insérer dans table `tasks`
6. **Action 5 :** Incrémenter `emails_used` dans la table `profiles`

---

## Étape 4 — Stripe : Paiement (à intégrer dans l'app)

Produits à créer dans Stripe Dashboard :
- **Gratuit** : 0 €/mois (pas de paiement, juste création de compte)
- **Solo** : 9 €/mois (price_solo_monthly)
- **Pro** : 19 €/mois (price_pro_monthly)
- **Business** : 9 €/siège/mois (price_business_per_seat)

Flux de paiement :
1. Utilisateur clique "Choisir ce plan" → Stripe Checkout Session créée côté serveur
2. Après paiement réussi → webhook Stripe → mise à jour `plan` et `emails_quota` dans Supabase table `profiles`
3. Dépassement de quota → facturation automatique Pay-as-you-go via Stripe Metered Billing

---

## Lien Hostinger → Replit (DNS)

Une fois l'app déployée sur Replit :
1. Dans Replit → Settings → Custom Domain → ajouter `app.ncvmail.com`
2. Replit fournit un enregistrement CNAME (ex: `ncv-mail.replit.app`)
3. Dans Hostinger → DNS → ajouter :
   - Type : CNAME
   - Nom : app
   - Valeur : (ce que Replit fournit)
4. Les boutons "Commencer gratuitement" sur ncvmail.com pointent vers `https://app.ncvmail.com/signup`

---

## Ce qui est DÉJÀ FAIT (ne pas refaire)

- ✅ Domaine `ncvmail.com` actif sur Hostinger
- ✅ Email pro `contact@ncvmail.com` créé
- ✅ Landing page publiée sur `ncvmail.com` avec Hero, Fonctionnalités, Tarifs, Footer
- ✅ Tarifs mis à jour sur la landing page (Gratuit 0€ / Solo 9€ / Pro 19€ / Business 9€/siège)
- ✅ Supabase : projet créé, tables `categories` et `emails` créées avec RLS
- ✅ Analyse concurrentielle complète (Superhuman, Shortwave, Spark, SaneBox, Gmail)
- ✅ Décisions technologiques validées
- ✅ Logo NCV Mail disponible

---

## Ce qu'on fait maintenant — Par où commencer

**Commence par créer le projet Replit :**
1. Nouveau Repl → template **"React TypeScript"** (Vite)
2. Nom : `ncv-mail`
3. Installer les dépendances : `@supabase/supabase-js`, `react-router-dom`, `lucide-react`, `@stripe/stripe-js`
4. Configurer les variables d'environnement dans Replit Secrets
5. Créer le fichier `src/lib/supabase.ts` avec le client Supabase
6. Développer dans cet ordre : Auth → Dashboard → Catégories → Tâches → Bilan → Paramètres → Abonnement

**Guide-moi étape par étape avec le code complet à copier-coller dans chaque fichier.**
