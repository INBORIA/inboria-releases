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

### 3.4 Coût des autres actions IA (recalculé strictement depuis les tokens, conversion 1 USD = 0,92 EUR)

Formule : `(tokens_in × 0,15 + tokens_out × 0,60) / 1 000 000 × 0,92`

| Action | Tokens entrée | Tokens sortie | Coût USD | **Coût EUR** |
|---|---|---|---|---|
| Brouillon de réponse | 1 500 | 400 | 0,000465 $ | **0,000428 €** |
| Régénération de brouillon | 1 500 | 400 | 0,000465 $ | **0,000428 €** |
| Variante de ton | 1 200 | 200 | 0,000300 $ | **0,000276 €** |
| Relance générée | 1 200 | 300 | 0,000360 $ | **0,000331 €** |
| Résumé de conversation | 2 000 | 200 | 0,000420 $ | **0,000386 €** |
| Chat support (1 message) | 800 | 200 | 0,000240 $ | **0,000221 €** |
| Brief quotidien (par utilisateur) | 3 000 | 500 | 0,000750 $ | **0,000690 €** |
| Reclassification manuelle | 900 | 150 | 0,000225 $ | **0,000207 €** |
| Création projet IA | 1 500 | 400 | 0,000465 $ | **0,000428 €** |
| Catégorisation projet auto | 900 | 150 | 0,000225 $ | **0,000207 €** |

*Note d'audit (rev. 3) : les valeurs Relance, Résumé, Chat et Brief ont été corrigées par recalcul strict depuis la formule. Les écarts précédents (0,000345 $ vs 0,000360 $ ; 0,000405 $ vs 0,000420 $ ; etc.) provenaient d'arrondis manuels et ont été éliminés.*

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

## 12. Scénario « pire cas réaliste » — abonné qui exploite toutes les fonctions IA

L'objectif de cette section est de mesurer **l'exposition maximale d'Inboria** par abonné qui :
1. Reçoit la moyenne Microsoft de **117 mails/jour calendaire** (= 3 510 mails/mois) → 100% triés par l'IA
2. **« joue avec l'app »** : utilise toutes les fonctions IA à un rythme intensif mais plausible

### 12.1 Hypothèses « abuser plausible »

| Action IA | Hypothèse worst case |
|---|---|
| Mails reçus & triés (triage + détection RDV) | 100% des 3 510 mails reçus |
| Brouillon IA généré | sur **80%** des mails reçus → 2 808 brouillons |
| Régénération de brouillon (utilisateur clique « réécrire ») | sur 30% des brouillons → 842 régénérations |
| Adapter le ton (formal / casual / court) | sur 50% des brouillons → 1 404 variantes |
| Relance IA générée | **5/jour** × 30 = 150 |
| Résumé de fil de conversation | sur 50% des fils → 1 755 |
| Reclassification manuelle (apprentissage) | **20/jour** × 30 = 600 |
| Détection RDV manuelle (clic bouton) | 100/mois |
| Chat support intelligent | **30 messages/jour** × 30 = 900 |
| Brief quotidien | 30/mois |
| Création projet via IA | 20/mois |
| Catégorisation projet automatique | 100/mois |

### 12.2 Coût OpenAI worst case par mois

⚠️ **Correction d'audit (rev. 3)** : la révision précédente double-comptait la détection RDV (déjà incluse dans le coût combiné 0,000306 €/mail analysé) et appliquait des coûts unitaires inexacts pour les variantes de ton, relances, résumés, chat et brief. Tableau corrigé ci-dessous avec les valeurs normalisées de la section 3.4.

| Action | Volume | Coût unitaire (EUR) | **Coût total** |
|---|---|---|---|
| Triage + détection RDV (combiné) | 3 510 | 0,000306 € | 1,074 € |
| Brouillons | 2 808 | 0,000428 € | 1,202 € |
| Régénérations | 842 | 0,000428 € | 0,360 € |
| Variantes de ton | 1 404 | 0,000276 € | 0,388 € |
| Relances | 150 | 0,000331 € | 0,050 € |
| Résumés conversation | 1 755 | 0,000386 € | 0,677 € |
| Reclassif manuelle | 600 | 0,000207 € | 0,124 € |
| Détection RDV manuelle | 100 | 0,000099 € | 0,010 € |
| Chat support | 900 | 0,000221 € | 0,199 € |
| Brief quotidien | 30 | 0,000690 € | 0,021 € |
| Création projets IA | 20 | 0,000428 € | 0,009 € |
| Catégorisation projets | 100 | 0,000207 € | 0,021 € |
| **TOTAL OpenAI worst case** | | | **4,135 €** |

### 12.3 Autres coûts directs « pire cas »

**Brevo SMTP** (mails sortants, réponses envoyées par l'utilisateur) :
- Hypothèse : 50 mails sortants/jour × 30 = 1 500 mails sortants/mois
- Plan Brevo Business 65 €/mois pour 20 000 mails mutualisé = 0,00325 €/mail
- **Coût Brevo / abonné worst case : 1 500 × 0,00325 € = 4,88 €**

**Supabase** (DB + auth + storage), pire cas dilution faible (100 abonnés actifs) :
- Plan Pro 25 $/mois (~23 €) base
- Compute add-on micro 10 $/mois si DB sollicitée
- Stockage emails (corpus 3 510 × 5 KB ≈ 18 MB/abonné/mois) : négligeable
- Egress (transfert) : ~50 MB/jour × 30 ≈ 1,5 GB/mois × 0,09 $/GB = 0,12 $
- **Worst case par abonné (mutualisé sur 100 abonnés) : ~1,00 €**
- À 1 000 abonnés : ~0,10 € / abonné

**Replit hébergement** (oublié dans rev. 1) :
- Reserved VM Hacker plan + Deployment + Membership ≈ 60 $/mois (~55 €) mutualisé
- À 100 abonnés : **0,55 € / abonné**
- À 500 abonnés : **0,11 € / abonné**
- À 1 000 abonnés : **0,055 € / abonné**

**Paddle** : identique aux sections précédentes.

### 12.4 Synthèse pire cas par plan (à 100 abonnés actifs = scénario early stage)

#### Plan Solo « abuser » (9 €/mois)

L'abuser dépasse le quota Solo (3 000) → 510 mails en Pay-as-you-go × 0,002 € = **1,02 € de revenu supplémentaire**.

| Poste | Montant |
|---|---|
| Revenu (9 € + dépassement 1,02 €) | **10,02 €** |
| OpenAI worst case | 4,135 € |
| Brevo | 4,88 € |
| Supabase (100 abonnés) | 1,00 € |
| Replit (100 abonnés) | 0,55 € |
| Paddle (2 transactions : abonnement + dépassement) | 0,95 + 0,50 + 0,05 + 0,50 = 2,00 € |
| **Total coûts directs** | **12,565 €** |
| **Marge nette** | **−2,545 € ⚠️ PERTE** |

#### Plan Pro « abuser » (19 €/mois)

L'abuser reste sous le quota Pro (10 000), pas de dépassement.

| Poste | Montant |
|---|---|
| Revenu | **19,00 €** |
| OpenAI worst case | 4,135 € |
| Brevo | 4,88 € |
| Supabase | 1,00 € |
| Replit | 0,55 € |
| Paddle | 1,45 € |
| **Total coûts directs** | **12,015 €** |
| **Marge nette** | **6,985 € (37%)** ✅ |

#### Plan Business « abuser » (9 €/siège, 3 sièges)

Chaque siège = même profil abuser que Pro.

| Poste / siège | Montant |
|---|---|
| Revenu / siège | **9,00 €** |
| OpenAI worst case | 4,135 € |
| Brevo | 4,88 € |
| Supabase | 1,00 € |
| Replit | 0,55 € |
| Paddle / siège | 0,62 € |
| **Total coûts directs / siège** | **11,185 €** |
| **Marge nette / siège** | **−2,185 € ⚠️ PERTE** |

### 12.5 Conclusion sur le pire cas

| Plan | Marge worst case « à 100 abonnés » | Verdict |
|---|---|---|
| Solo | **−2,545 €** | ⚠️ **DÉFICITAIRE** si user abuse |
| Pro | +6,985 € (37%) | ✅ Reste rentable |
| Business / siège | **−2,185 €** | ⚠️ **DÉFICITAIRE** si user abuse |

**Risques identifiés** :
1. Le **Pay-as-you-go actuel ne couvre que les mails entrants triés**, pas les actions IA secondaires (brouillons, chat, etc.) → un abuser peut consommer indéfiniment sans payer plus
2. Les **mails sortants Brevo** sont le 2ᵉ poste de coût après OpenAI, et ne sont pas plafonnés
3. **Solo et Business** à 9 € sont **structurellement vulnérables** à un usage abusif

---

## 13. Recommandation : passage à un système de crédits IA

### 13.1 Principe

Remplacer le quota « X mails par mois » par une **réserve de crédits IA** où **chaque action IA consomme un nombre défini de crédits**. Le décompte est transparent, affiché à côté de chaque bouton dans l'interface.

**Avantages** :
- Plafond strict de consommation IA → coûts maîtrisés
- Le client paie pour ce qu'il consomme réellement
- Possibilité d'acheter des **packs de crédits supplémentaires** (au lieu de forcer l'upgrade)
- Pédagogie : le client voit le coût de chaque action, valorise la fonctionnalité

### 13.2 Barème de crédits proposé

Unité de base : **1 crédit = coût d'un mail entrant analysé (triage + détection RDV combinés) = 0,000306 €**.

Principe clé : **chaque action déclenchant un coût direct (OpenAI ou Brevo) consomme des crédits proportionnels à ce coût.** Le mail sortant (Brevo) est intégré au barème pour couvrir le 2ᵉ poste de coût direct.

| Action | Crédits | Coût direct (€) | Couverture (crédits × 0,000306 €) |
|---|---|---|---|
| Mail entrant analysé (triage + RDV) | **1** | 0,000306 € | 0,000306 € ✅ |
| Brouillon IA généré | **2** | 0,000428 € | 0,000612 € ✅ |
| Régénération de brouillon | **2** | 0,000428 € | 0,000612 € ✅ |
| Variante de ton (formal / casual / court) | **1** | 0,000276 € | 0,000306 € ✅ |
| Relance IA générée | **2** | 0,000331 € | 0,000612 € ✅ |
| Résumé de fil de conversation | **2** | 0,000386 € | 0,000612 € ✅ |
| Reclassification manuelle | **1** | 0,000207 € | 0,000306 € ✅ |
| Détection RDV manuelle | **gratuit** | 0,000099 € | absorbé (mutualisé sync) |
| Chat support intelligent (1 message) | **1** | 0,000221 € | 0,000306 € ✅ |
| Brief quotidien (1×/j max) | **gratuit** | 0,000690 € | mutualisé / produit d'appel |
| Création projet via IA | **2** | 0,000428 € | 0,000612 € ✅ |
| Catégorisation projet automatique | **1** | 0,000207 € | 0,000306 € ✅ |
| **Mail envoyé via Brevo** | **10** | **0,003 € (SMTP)** | **0,00306 € ✅** |
| Lecture, recherche, tri, ouverture | **gratuit** | 0 € | aucun appel IA ni envoi |

*Note (rev. 3) : la valeur précédente de 8 crédits/envoi était basée sur un coût de référence erroné de 0,000405 €. Recalcul depuis la baseline corrigée 0,000306 € : 0,003 / 0,000306 = 9,80, arrondi à **10 crédits/envoi**.*

### 13.3 Plans (quotas existants conservés, exprimés en crédits)

Les quotas actuels (3 000 / 10 000 / 10 000) sont conservés tels quels et **simplement renommés en crédits** : 1 ancien « mail trié » = 1 crédit, ce qui garantit la rétrocompatibilité totale pour les abonnés existants.

| Plan | Prix | Crédits/mois inclus |
|---|---|---|
| Essai | gratuit | **100** |
| Solo | 9 € | **3 000** |
| Pro | 19 € | **10 000** |
| Business | 9 € / siège | **10 000 / siège** |

**Dépassement (Pay-as-you-go en crédits) — étendu à TOUTES les fonctions consommatrices de l'app** :

Contrairement au PAYG actuel (qui ne facture que les mails entrants au-delà du quota), le nouveau PAYG en crédits couvre **chaque action listée au barème 13.2** dès que le solde de crédits inclus est épuisé :

- ✅ Triage entrant supplémentaire (1 crédit / mail)
- ✅ Brouillons, régénérations, variantes de ton
- ✅ Relances, résumés de fil
- ✅ Reclassifications, catégorisation projets
- ✅ Messages de chat support
- ✅ Création de projets via IA
- ✅ **Mails envoyés via Brevo (10 crédits / envoi)**

Tarif :
- **Pack pré-acheté : 5 000 crédits = 4,90 €** (≈ 0,00098 €/crédit)
- **Dépassement automatique au compteur (sans pack) : 0,0012 €/crédit**

→ Aucune action consommatrice n'échappe au PAYG : tout coût direct (OpenAI ou Brevo) est désormais refacturé proportionnellement au-delà du quota inclus.

### 13.4 Vérification du pire cas — profil « abuser mixte » réaliste

L'abonné ne fait pas QUE recevoir des mails ni QUE en envoyer : il combine triage entrant intensif + envois + actions IA secondaires. Profil retenu :

| Action | Hypothèse abuser mixte | Crédits/unité | **Total crédits** |
|---|---|---|---|
| Triage entrant + RDV | 3 510 mails reçus (117/j) | 1 | 3 510 |
| Mails envoyés via Brevo | **30% des reçus = 1 050** | **10** | **10 500** |
| Brouillons IA | 50% des envois = 525 | 2 | 1 050 |
| Régénérations | 30% des brouillons = 158 | 2 | 316 |
| Variantes de ton | 50% des brouillons = 263 | 1 | 263 |
| Relances IA | 5/j × 30 = 150 | 2 | 300 |
| Résumés de fil | 10% des reçus = 350 | 2 | 700 |
| Reclassif manuelle | 20/j × 30 = 600 | 1 | 600 |
| Chat support | 30 messages/j × 30 = 900 | 1 | 900 |
| Création projets IA | 20/mois | 2 | 40 |
| Catégorisation projets | 100/mois | 1 | 100 |
| **TOTAL crédits consommés** | | | **18 279** |

#### Coûts directs réels associés (worst case mixte)

| Poste | Calcul détaillé | Montant |
|---|---|---|
| Triage + RDV | 3 510 × 0,000306 € | 1,074 € |
| Brouillons | 525 × 0,000428 € | 0,225 € |
| Régénérations | 158 × 0,000428 € | 0,068 € |
| Variantes ton | 263 × 0,000276 € | 0,073 € |
| Relances | 150 × 0,000331 € | 0,050 € |
| Résumés | 350 × 0,000386 € | 0,135 € |
| Reclassif | 600 × 0,000207 € | 0,124 € |
| Chat support | 900 × 0,000221 € | 0,199 € |
| Brief quotidien | 30 × 0,000690 € | 0,021 € |
| Création projets | 20 × 0,000428 € | 0,009 € |
| Catégorisation projets | 100 × 0,000207 € | 0,021 € |
| **Sous-total OpenAI** | | **1,999 €** |
| Brevo SMTP | 1 050 × 0,003 € | **3,150 €** |
| Supabase (100 abonnés mutualisé) | | 1,000 € |
| Replit (100 abonnés mutualisé) | | 0,550 € |
| **Total coûts directs hors Paddle** | | **6,699 €** |

#### Marge worst case mixte par plan (PAYG en crédits = 0,0012 €/crédit)

| Plan | Crédits inclus | Dépassement (crédits) | Revenu PAYG | Revenu total | Paddle | Coûts directs totaux | **Marge** | **%** |
|---|---|---|---|---|---|---|---|---|
| **Solo** (9 €) | 3 000 | 15 279 × 0,0012 € | 18,335 € | **27,335 €** | (9 × 5% + 0,50) + (18,335 × 5% + 0,50) = 2,367 € | 6,699 + 2,367 = **9,066 €** | **+18,269 €** | **67%** ✅ |
| **Pro** (19 €) | 10 000 | 8 279 × 0,0012 € | 9,935 € | **28,935 €** | (19 × 5% + 0,50) + (9,935 × 5% + 0,50) = 2,447 € | 6,699 + 2,447 = **9,146 €** | **+19,789 €** | **68%** ✅ |
| **Business** (9 €/siège, 3 sièges) | 10 000/siège | 8 279 × 0,0012 € | 9,935 €/siège | **18,935 €/siège** | ((27 + 29,805) × 5% + 2 × 0,50) / 3 = 1,280 €/siège | 6,699 + 1,280 = **7,979 €/siège** | **+10,956 €/siège** | **58%** ✅ |

**Conclusion** : avec le mail envoyé intégré au barème de crédits (**10 crédits/envoi**) et un Pay-as-you-go uniformisé en crédits à 0,0012 €/crédit, **les trois plans deviennent étanches au pire cas mixte**, sans aucun changement de prix ni de quota. Le Business à 9 €/siège, qui était déficitaire de −2,185 €/siège dans le modèle actuel, repasse à +10,956 €/siège.

### 13.5 Mise en œuvre technique

1. Ajouter un champ `credits_used` (int) et `credits_quota` (int) à la table `profiles`
2. Créer une fonction utilitaire `consumeCredits(userId, amount, action)` appelée par chaque endpoint IA
3. Migrer les anciens compteurs `emails_used` (1 mail = 1 crédit pour la rétrocompatibilité)
4. Refondre la page Abonnement pour afficher la consommation en crédits + barème
5. Afficher le coût en crédits sur chaque bouton IA (ex. « Générer brouillon (2 crédits) »)
6. Ajouter une page « Acheter un pack de crédits » avec checkout Paddle
7. Webhook Paddle : crédit le compte à la réception du paiement pack

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
