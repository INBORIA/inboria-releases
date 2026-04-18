# Audit de rentabilité — Inboria

**Document destiné à audit externe**
Date : 18 avril 2026 (révision 2 — corrections suite à pré-audit)
Préparé pour : vérification indépendante de la structure de coûts et marges

> **Notes de révision (rev. 2)** :
> - Correction de la conversion USD → EUR sur tous les coûts unitaires des actions IA secondaires (erreur signalée : valeurs en $ étiquetées € sans conversion).
> - Recalcul des marges Business à 10 et 50 sièges (anciennes valeurs surévaluées).
> - Re-qualification de l'hypothèse « 30-40% de mails actionable » comme **hypothèse interne de modélisation**, et non comme résultat issu de l'étude Microsoft.
> - Précision sur l'extrapolation 117 mails/j × 30 = 3 500 mails/mois : il s'agit d'une projection sur **jours calendaires**, pas sur jours ouvrés.
> - Ajout d'un avertissement sur les tarifs OpenAI : valeurs basées sur la grille **gpt-4o-mini en vigueur à la date du document** ; à revérifier en direct avant publication finale.
> - Taux de conversion retenu : **1 USD = 0,92 EUR** (à actualiser selon période d'audit).

---

## 1. Description de l'application

**Inboria** est une solution SaaS B2B « Email Autopilot » destinée aux PME et indépendants. L'application connecte la boîte mail professionnelle de l'utilisateur (Gmail, Outlook, IMAP) et applique de l'intelligence artificielle pour automatiser le tri, la priorisation et le traitement des emails.

**Fonctionnalités IA principales** :
- **Triage automatique** de chaque mail entrant (catégorisation, priorité, résumé, détection spam, extraction de tâches)
- **Détection automatique de rendez-vous** mentionnés dans les emails (date/heure → événement calendrier)
- **Génération de brouillons de réponse** sur demande
- **Génération de relances** personnalisées
- **Résumé de fil de conversation**
- **Brief quotidien** (synthèse mutualisée)
- **Chat support intelligent** dans l'application
- **Reclassification manuelle** par l'utilisateur (apprentissage de règles)

**Stack technique** :
- Frontend web : React + Vite (TypeScript)
- Backend : Express (Node.js / TypeScript)
- Base de données + auth : Supabase (PostgreSQL)
- Modèle IA : OpenAI **gpt-4o-mini**
- Paiement : Paddle (Merchant of Record)
- Email transactionnel : Brevo SMTP
- Hébergement : Replit
- Application mobile : Expo (iOS/Android)
- Multilingue : FR / EN / NL / DE / ES

**Cible commerciale** : PME, dirigeants, professions libérales, freelances européens.

---

## 2. Plans tarifaires actuels

| Plan | Prix mensuel | Quota mails/mois | Public cible |
|---|---|---|---|
| **Essai** | Gratuit (one-shot) | 100 | Découverte produit |
| **Solo** | 9 € | 3 000 | Indépendants, freelances |
| **Pro** | 19 € | 10 000 | Professionnels, dirigeants PME |
| **Business** | 9 € / siège (min 3, max 50 sièges) | 10 000 / siège | Équipes, boîtes partagées |

**Définition de « 1 quota »** : 1 email entrant analysé par l'IA = 1 unité consommée.

**Dépassement (Pay-as-you-go)** :
- Solo : 0,002 € par email supplémentaire
- Pro : 0,001 € par email supplémentaire
- Business : 0,001 € par email supplémentaire

---

## 3. Coût OpenAI réel par mail analysé

### 3.1 Tarifs officiels OpenAI (gpt-4o-mini, 2025)

- **Tokens en entrée** : 0,15 $ / 1 000 000 tokens
- **Tokens en sortie** : 0,60 $ / 1 000 000 tokens
- **Conversion** : 1 USD ≈ 0,92 EUR (à ajuster selon période)

> ⚠️ **Avertissement** : OpenAI fait évoluer régulièrement sa grille tarifaire et met aujourd'hui en avant des modèles plus récents (GPT-5, etc.). Les calculs ci-dessous restent **valides pour gpt-4o-mini** (modèle actuellement utilisé en production par Inboria), mais les prix doivent être confirmés en direct sur https://openai.com/api/pricing/ au moment de l'audit final.

### 3.2 Décomposition d'un mail synchronisé (2 appels API)

#### Appel 1 — Triage (catégorie, priorité, résumé, spam, tâches)

| Élément | Tokens estimés |
|---|---|
| System prompt (instructions de tri) | ~200 |
| Email (sender + sujet + corps tronqué à 800 caractères) | ~250 |
| Liste des catégories existantes (~15) | ~50 |
| Règles apprises personnalisées | ~50 |
| Instructions JSON + spam + tâches | ~350 |
| **Total entrée** | **~900 tokens** |
| Sortie JSON (structure fixe) | **~150 tokens** |

**Coût** : 900 × 0,15 $/M + 150 × 0,60 $/M = **0,000225 $** ≈ **0,000207 €**

#### Appel 2 — Détection de rendez-vous

| Élément | Tokens estimés |
|---|---|
| System prompt | ~150 |
| Email (sender + sujet + corps 800 c.) | ~250 |
| **Total entrée** | **~400 tokens** |
| Sortie (souvent `{"hasAppointment": false}`) | **~80 tokens** |

**Coût** : 400 × 0,15 $/M + 80 × 0,60 $/M = **0,000108 $** ≈ **0,000099 €**

#### Total par mail analysé

**0,000333 $ × 0,92 = 0,000306 €** (≈ **0,00031 €**, fourchette : 0,00025 € à 0,00040 € selon longueur du mail)

### 3.3 Coût OpenAI par paliers de quota (en EUR après conversion 0,92)

| Volume mensuel | Coût OpenAI (USD) | Coût OpenAI (EUR) |
|---|---|---|
| 100 mails | 0,033 $ | **0,031 €** |
| 1 000 mails | 0,333 $ | **0,306 €** |
| 3 000 mails (Solo) | 1,00 $ | **0,920 €** |
| 10 000 mails (Pro / Business par siège) | 3,33 $ | **3,06 €** |
| 50 000 mails | 16,65 $ | **15,32 €** |
| 100 000 mails | 33,30 $ | **30,64 €** |

### 3.4 Coût des autres actions IA (avec conversion USD → EUR)

| Action | Tokens entrée | Tokens sortie | Coût USD | **Coût EUR** |
|---|---|---|---|---|
| Brouillon de réponse | ~1 500 | ~400 | 0,000465 $ | **0,000428 €** |
| Relance générée | ~1 200 | ~300 | 0,000345 $ | **0,000317 €** |
| Résumé de conversation | ~2 000 | ~200 | 0,000405 $ | **0,000373 €** |
| Chat support (1 message) | ~800 | ~200 | 0,000225 $ | **0,000207 €** |
| Brief quotidien (par utilisateur) | ~3 000 | ~500 | 0,000743 $ | **0,000683 €** |
| Reclassification manuelle | ~900 | ~150 | 0,000225 $ | **0,000207 €** |

---

## 4. Données de marché — usage réel

**Source factuelle** : Microsoft Work Trend Index Special Report — 17 juin 2025
(Étude basée sur signaux agrégés Microsoft 365 + enquête auprès de 31 000 knowledge workers dans 31 marchés)

- **Employé moyen** : reçoit **117 emails / jour** (donnée publiée par Microsoft)
- Extrapolation interne sur **30 jours calendaires** : ~3 500 mails / mois
  (à pondérer si raisonnement sur jours ouvrés : ~2 500 mails / mois pour ~22 jours ouvrés)
- Repère antérieur sectoriel : ~121 emails / jour

**Hypothèse interne de modélisation (non issue de Microsoft)** :
- La part de mails **« actionable »** (nécessitant une réponse ou action humaine concrète) est estimée à **~30-40%** par Inboria, sur la base d'observations terrain et de jugement sectoriel.
- ⚠️ Cette hypothèse est utilisée uniquement pour modéliser l'usage probable des actions IA secondaires (brouillons, relances, résumés). Elle n'est pas fournie par l'étude Microsoft et doit être validée par une mesure interne sur cohorte réelle d'utilisateurs Inboria avant publication chiffrée.

**Implication pour Inboria** :
- Sur 100% des mails reçus → 100% subissent le triage IA (consomment du quota)
- Sur ~35% supposés « actionable » → l'utilisateur peut déclencher des actions IA secondaires

---

## 5. Hypothèses d'usage pour le calcul de marge

**Profil « utilisateur à pleine charge réaliste »** (cas le plus défavorable pour la marge) :

| Variable | Hypothèse |
|---|---|
| Mails reçus & triés / mois | 100% du quota du plan |
| Mails « actionable » | 35% des mails reçus |
| Brouillon IA généré | 50% des actionables |
| Relance IA générée | 20% des actionables |
| Résumé conversation | 30% des actionables |
| Chat support (messages/mois) | ~150 |
| Brief quotidien | 30 × 0,000743 € ≈ 0,022 € / mois |

---

## 6. Coûts directs additionnels

| Poste | Détail | Coût mutualisé / utilisateur |
|---|---|---|
| **Supabase** (PostgreSQL + auth) | ~25 $/mois pour ~500 utilisateurs | ~0,05 € |
| **Replit** (hébergement) | ~20 $/mois mutualisé | ~0,04 € |
| **Brevo SMTP** | ~9-30 $/mois selon volume | ~0,05 € |
| **Domaine, monitoring, divers** | ~5 $/mois mutualisé | ~0,01 € |
| **Sous-total infra mutualisée** | | **~0,15 € / utilisateur actif** |

(Ces montants augmenteront avec l'échelle mais le coût marginal par utilisateur additionnel reste très faible.)

**Frais Paddle** (Merchant of Record) :
- **Commission variable** : 5% du montant de la transaction
- **Frais fixe** : 0,50 € par transaction
- Particularité plan **Business** : 1 seule transaction regroupe tous les sièges → le frais fixe de 0,50 € est **mutualisé**

---

## 7. Calcul de marge nette par plan (à pleine charge réaliste)

> **Note méthodologique (rev. 2)** : tous les calculs ci-dessous utilisent les coûts unitaires OpenAI **convertis en EUR** (taux 1 USD = 0,92 EUR), conformément à la correction signalée au pré-audit.

### 7.1 Plan Solo — 9 €

| Poste | Calcul | Montant |
|---|---|---|
| Triage IA (3 000 mails) | 3 000 × 0,000306 € | 0,918 € |
| Brouillons (1 050 × 50%) | 525 × 0,000428 € | 0,225 € |
| Relances (1 050 × 20%) | 210 × 0,000317 € | 0,067 € |
| Résumés (1 050 × 30%) | 315 × 0,000373 € | 0,117 € |
| Chat support | 150 × 0,000207 € | 0,031 € |
| Brief quotidien | 30 × 0,000683 € | 0,020 € |
| **Sous-total OpenAI** | | **1,378 €** |
| Paddle | 9 × 5% + 0,50 € | 0,95 € |
| Infra mutualisée | | 0,15 € |
| **Total coûts directs** | | **2,48 €** |
| **Marge nette** | 9 € − 2,48 € | **6,52 €** |
| **% marge** | | **72%** |

### 7.2 Plan Pro — 19 €

| Poste | Calcul | Montant |
|---|---|---|
| Triage IA (10 000 mails) | 10 000 × 0,000306 € | 3,06 € |
| Brouillons (3 500 × 50%) | 1 750 × 0,000428 € | 0,749 € |
| Relances (3 500 × 20%) | 700 × 0,000317 € | 0,222 € |
| Résumés (3 500 × 30%) | 1 050 × 0,000373 € | 0,392 € |
| Chat support | 150 × 0,000207 € | 0,031 € |
| Brief quotidien | 30 × 0,000683 € | 0,020 € |
| **Sous-total OpenAI** | | **4,474 €** |
| Paddle | 19 × 5% + 0,50 € | 1,45 € |
| Infra mutualisée | | 0,15 € |
| **Total coûts directs** | | **6,07 €** |
| **Marge nette** | 19 € − 6,07 € | **12,93 €** |
| **% marge** | | **68%** |

### 7.3 Plan Business — 9 € / siège (3 sièges minimum)

**Par siège** (équipe de 3 sièges = 27 € total facturés) :

| Poste | Calcul | Montant |
|---|---|---|
| Triage IA (10 000 mails) | 10 000 × 0,000306 € | 3,06 € |
| Actions IA secondaires (mêmes hypothèses que Pro) | | 1,414 € |
| **Sous-total OpenAI / siège** | | **4,474 €** |
| Paddle (mutualisé sur 3 sièges) | (27 × 5% + 0,50) / 3 | 0,617 € |
| Infra mutualisée | | 0,15 € |
| **Total coûts directs / siège** | | **5,24 €** |
| **Marge nette / siège** | 9 € − 5,24 € | **3,76 €** |
| **% marge** | | **42%** |

**Évolution de la marge avec la taille de l'équipe** (le frais fixe Paddle de 0,50 € se dilue sur plus de sièges) :

| Taille équipe | Paddle / siège | Total coûts / siège | Marge / siège | % marge |
|---|---|---|---|---|
| 3 sièges | 0,617 € | 5,24 € | 3,76 € | **41,8%** |
| 10 sièges | 0,500 € | 5,12 € | 3,88 € | **43,1%** |
| 50 sièges | 0,460 € | 5,08 € | 3,92 € | **43,6%** |

(Détail Paddle : 10 sièges → (90 × 5% + 0,50)/10 = 0,50 € ; 50 sièges → (450 × 5% + 0,50)/50 = 0,46 €.)

---

## 8. Mécanique « Pay-as-you-go » (dépassement de quota)

Lorsqu'un utilisateur dépasse son quota mensuel inclus, chaque mail supplémentaire est facturé à l'unité, sans plafond et sans interruption de service.

### 8.1 Tarifs actuels du dépassement

| Plan | Prix par mail au-delà du quota |
|---|---|
| Solo | 0,002 € / mail |
| Pro | 0,001 € / mail |
| Business | 0,001 € / mail |

### 8.2 Calcul de la marge sur dépassement

Coût direct OpenAI par mail supplémentaire = **0,00033 €** (identique au triage standard).

Hypothèse : les frais Paddle ne s'appliquent pas à chaque mail individuellement — le dépassement est facturé en lot mensuel (1 transaction supplémentaire de N × prix unitaire), donc l'impact Paddle est négligeable hors frais fixe sur la facture additionnelle.

| Plan | Prix unitaire | Coût OpenAI | **Marge brute / mail** | **% marge** |
|---|---|---|---|---|
| Solo | 0,002 € | 0,00033 € | **0,00167 €** | **84%** |
| Pro | 0,001 € | 0,00033 € | **0,00067 €** | **67%** |
| Business | 0,001 € | 0,00033 € | **0,00067 €** | **67%** |

### 8.3 Exemples de facturation Pay-as-you-go

**Cas A** — Utilisateur Solo qui reçoit 4 500 mails un mois donné :
- Quota inclus : 3 000 mails (compris dans les 9 €)
- Dépassement : 1 500 mails × 0,002 € = **3,00 € supplémentaires**
- Facture totale du mois : 9 € + 3 € = **12 €**
- Coût direct OpenAI sur le dépassement : 1 500 × 0,00033 € = 0,50 €
- Marge brute sur dépassement : **2,50 € (83%)**

**Cas B** — Utilisateur Pro qui reçoit 15 000 mails un mois (dirigeant très chargé, 500 mails/jour) :
- Quota inclus : 10 000 mails (compris dans les 19 €)
- Dépassement : 5 000 mails × 0,001 € = **5,00 € supplémentaires**
- Facture totale du mois : 19 € + 5 € = **24 €**
- Coût direct OpenAI sur le dépassement : 5 000 × 0,00033 € = 1,65 €
- Marge brute sur dépassement : **3,35 € (67%)**

**Cas C** — Équipe Business de 5 sièges, 1 siège dépasse de 8 000 mails :
- Quota inclus : 5 × 10 000 = 50 000 mails (compris dans 5 × 9 € = 45 €)
- Dépassement : 8 000 mails × 0,001 € = **8,00 € supplémentaires**
- Facture totale : 45 € + 8 € = **53 €**
- Marge brute sur dépassement : 8 € − (8 000 × 0,00033 €) = 8 € − 2,64 € = **5,36 € (67%)**

### 8.4 Avantages du modèle Pay-as-you-go

1. **Aucune interruption de service** pour le client (pas de blocage à 100% du quota)
2. **Sécurise la marge** : tout mail supplémentaire reste rentable (67-84%)
3. **Pousse au bon plan** : si un client dépasse régulièrement, il bascule naturellement vers le plan supérieur (meilleur rapport €/quota)
4. **Transparence** : prix unitaire affiché clairement à l'inscription

---

## 9. Synthèse rentabilité (rev. 2 — chiffres après corrections)

| Plan | Prix | Coûts directs (full usage) | Marge nette | % marge |
|---|---|---|---|---|
| Solo | 9 € | 2,48 € | 6,52 € | **72%** |
| Pro | 19 € | 6,07 € | 12,93 € | **68%** |
| Business (par siège, 3 sièges) | 9 € | 5,24 € | 3,76 € | **42%** |
| Business (par siège, 10 sièges) | 9 € | 5,12 € | 3,88 € | **43%** |
| Business (par siège, 50 sièges) | 9 € | 5,08 € | 3,92 € | **44%** |

**Marge brute moyenne pondérée attendue** (mix hypothétique 60% Solo / 30% Pro / 10% Business) : **≈ 66%**

---

## 10. Points d'attention pour l'auditeur

1. **Vérifier les tarifs OpenAI actuels** sur https://openai.com/api/pricing/ (peuvent évoluer ; OpenAI met aujourd'hui en avant des modèles plus récents type GPT-5, mais Inboria utilise toujours gpt-4o-mini)
2. **Re-qualifier l'hypothèse 30-40% « actionable »** : il s'agit d'une **hypothèse interne de modélisation** Inboria, et non d'un résultat de l'étude Microsoft. À valider sur un échantillon réel d'utilisateurs en production
3. **Préciser l'extrapolation 117 mails/jour → mensuel** : 3 500 mails/mois correspond à 30 jours **calendaires**. Sur 22 jours ouvrés, ce serait ~2 500 mails/mois
4. **Vérifier la grille Paddle** appliquée au compte (5% + 0,50 € est la grille standard EU ; certains contrats négociés diffèrent)
5. **Coûts Supabase** : susceptibles d'augmenter par paliers (Pro plan à 25 $/mois jusqu'à un certain volume, puis tarifs par compute / stockage / bande passante au-delà)
6. **Coûts mobiles** : non chiffrés ici (Expo / EAS Build / publication App Store / Google Play). Marginaux mais à intégrer si une analyse complète est demandée
7. **Coûts variables OpenAI** : la fourchette par mail (0,00025 € à 0,00040 €) dépend de la longueur réelle du mail. La moyenne 0,00031 € est une estimation prudente médiane. Pour un audit définitif, faire échantillon réel sur 1 000 mails de production
8. **Taux de change USD/EUR** : tous les calculs ci-dessus utilisent **1 USD = 0,92 EUR**. Ce taux doit être actualisé à la date de l'audit (BCE de référence)
9. **Plan Business à 9 €/siège** : marge la plus faible (42-44%). Le repositionner à 12-15 €/siège ferait passer la marge à 60-68% sans déformation commerciale majeure (reste compétitif sur le segment équipes)
10. **TVA** : non incluse dans les calculs (Paddle gère la TVA via son statut de Merchant of Record, mais les revenus présentés ici sont HT)

---

## 11. Sources

- OpenAI Pricing : https://openai.com/api/pricing/
- Microsoft Work Trend Index 2025 : https://news.microsoft.com/de-ch/2025/06/17/new-microsoft-study-reveals-the-rise-of-the-infinite-workday-40-of-employees-check-email-before-6-a-m-evening-meetings-up-16/
- Microsoft Worklab : https://www.microsoft.com/en-us/worklab/work-trend-index/breaking-down-infinite-workday
- Paddle Pricing : https://www.paddle.com/pricing
- Supabase Pricing : https://supabase.com/pricing
- Brevo Pricing : https://www.brevo.com/pricing/

---

*Fin du document.*
