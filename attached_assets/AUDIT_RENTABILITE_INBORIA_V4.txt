# Audit de rentabilité — Inboria

**Document destiné à audit externe**
Date : 18 avril 2026 (révision 4 — post pré-filtre IA + renommage en crédits IA)
Préparé pour : vérification indépendante de la structure de coûts et marges

> **Notes de révision (rev. 4)** :
> - Intégration du **pré-filtre IA** déployé en production. Pour chaque mail entrant, deux étages déterministes (analyse des en-têtes RFC + cache d'expéditeurs récurrents par utilisateur) décident s'il faut réellement appeler OpenAI. **60 à 70 %** des mails entrants sont désormais classés sans aucun appel IA. Hypothèse retenue pour le calcul : **65 % de filtrage médian**, soit un coût IA moyen par mail reçu qui chute de **0,000306 €** à **0,000107 €** (–65 %).
> - Renommage acté de **« quotas emails »** en **« crédits IA »** sur toutes les surfaces utilisateur (web + mobile + FAQ assistant intégré), dans les 5 langues (FR / EN / NL / DE / ES). La mécanique sous-jacente (1 mail reçu = 1 unité consommée) et les noms internes du code (variables `emails_used`, endpoints `/api/profile/recount-quota`) sont conservés pour rétrocompatibilité.
> - Recalcul intégral des sections 3, 7, 9, 12 et 14.
> - Réécriture de la section 13 (système de crédits) avec deux variantes commerciales clairement opposées.
> - Ajout d'une analyse de sensibilité au taux de filtrage (50 % / 65 % / 80 %) au § 10.
> - Tarifs OpenAI **inchangés** vs rev. 3 (gpt-4o-mini : 0,15 $/M input, 0,60 $/M output ; conversion 1 USD = 0,92 EUR).
> - Coûts unitaires des actions IA secondaires (brouillons, relances, résumés, chat, brief, etc.) **inchangés** : ces actions sont déclenchées explicitement par l'utilisateur, le pré-filtre n'a aucun effet sur elles.

---

## 1. Description de l'application

**Inboria** est une solution SaaS B2B « Email Autopilot » destinée aux PME et indépendants. L'application connecte la boîte mail professionnelle de l'utilisateur (Gmail, Outlook, IMAP) et applique de l'intelligence artificielle pour automatiser le tri, la priorisation et le traitement des emails.

**Fonctionnalités IA principales** :
- **Pré-filtre déterministe** (nouveau, en production) : avant tout appel OpenAI, un module local décide si le mail nécessite réellement un traitement IA. Les newsletters (`List-Unsubscribe`), les automates (`Auto-Submitted`, `Precedence: bulk`), les expéditeurs `noreply@*` / `notifications@*` / `mailer-daemon@*` et les expéditeurs récurrents déjà classés par l'utilisateur sont gérés sans token consommé.
- **Triage automatique** des mails restants (catégorisation, priorité, résumé, détection spam, extraction de tâches)
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

| Plan | Prix mensuel | Crédits IA / mois | Public cible |
|---|---|---|---|
| **Essai** | Gratuit (one-shot) | 100 | Découverte produit |
| **Solo** | 9 € | 3 000 | Indépendants, freelances |
| **Pro** | 19 € | 10 000 | Professionnels, dirigeants PME |
| **Business** | 9 € / siège (min 3, max 50 sièges) | 10 000 / siège | Équipes, boîtes partagées |

**Définition actuelle d'« 1 crédit IA »** : 1 mail entrant reçu = 1 crédit consommé. Le pré-filtre n'a actuellement **aucune répercussion sur la consommation visible côté client** — il n'agit que sur le coût d'infrastructure encaissé par Inboria. Voir § 13 pour les options stratégiques d'évolution de cette définition.

**Pay-as-you-go (dépassement)** :
- Solo : 0,002 € par crédit supplémentaire
- Pro : 0,001 € par crédit supplémentaire
- Business : 0,001 € par crédit supplémentaire

---

## 3. Coût OpenAI réel par mail reçu — avec pré-filtre

### 3.1 Tarifs officiels OpenAI (gpt-4o-mini, 2025)

- **Tokens en entrée** : 0,15 $ / 1 000 000 tokens
- **Tokens en sortie** : 0,60 $ / 1 000 000 tokens
- **Conversion** : 1 USD ≈ 0,92 EUR (à ajuster selon période)

> ⚠️ Tarifs valides pour gpt-4o-mini (modèle utilisé en production par Inboria), à reconfirmer sur https://openai.com/api/pricing/ à la date d'audit.

### 3.2 Mécanique du pré-filtre — détail technique vérifiable

Implémentation : `artifacts/api-server/src/services/pre-filter.ts`. Pour chaque mail entrant, l'algorithme exécute deux étages dans l'ordre :

**Étage 1 — Headers RFC + pattern sender** (zéro lookup base) :
- Présence de `List-Unsubscribe` ou `List-Unsubscribe-Post` → catégorie « Newsletters »
- `Auto-Submitted: auto-generated` ou `auto-replied` → « Notifications »
- `Precedence: bulk` / `list` / `junk` → « Newsletters »
- Local-part de l'expéditeur correspondant à `^(noreply|no-reply|donotreply|notification|notifications|alerts?|mailer-daemon|postmaster|automated|news|newsletter|bounce|return|email|mailing|broadcast|digest)$` (et sujet sans mot-clé urgent type `facture`, `password`, `2fa`, `securit`, etc.) → « Notifications »

**Étage 2 — Cache `sender_cache` (lookup Supabase)** :
- Si l'expéditeur a été classé ≥ 3 fois pour cet utilisateur avec un verdict stable, dans les 60 derniers jours, le résultat est réappliqué directement
- Invalidation automatique sur reclassification manuelle

Si aucun étage ne matche, le mail part en flux IA standard (triage + détection RDV combinés). En cas d'erreur, le pré-filtre est **fail-safe** : il retourne `hit: false` et le mail est traité par OpenAI.

**Métrique de production** : 60 à 70 % des mails entrants sont attrapés par l'un des deux étages, selon la composition de la boîte (les comptes B2B avec beaucoup de newsletters pros tendent vers 70 %, les comptes très conversationnels vers 60 %). **Hypothèse retenue pour le calcul : 65 %** (médiane).

> 🔍 *Note auditeur* : ce taux peut être vérifié en interrogeant les compteurs `prefilter_hits` / `cache_hits` / `ai_calls` du profil utilisateur (voir RPC `increment_prefilter_metrics`). Une analyse de sensibilité à 50 % et 80 % est fournie au § 10.

### 3.3 Coût combiné triage + RDV — par mail reçu

Pour un mail qui **déclenche** OpenAI (35 % des cas) :

- Appel triage : 900 tokens in + 150 tokens out = 0,000225 $ → **0,000207 €**
- Appel détection RDV : 400 tokens in + 80 tokens out = 0,000108 $ → **0,000099 €**
- **Coût d'un mail traité par IA : 0,000333 $ ≈ 0,000306 €** (inchangé vs rev. 3)

Pour un mail filtré en amont (65 % des cas) : **0 €**.

**Coût moyen pondéré par mail reçu** :
`(0,35 × 0,000306 €) + (0,65 × 0 €) =` **0,000107 €** (vs 0,000306 € avant pré-filtre)

→ **Économie de 65 %** sur la ligne triage, à volume client constant.

### 3.4 Coût OpenAI par paliers de quota — recalculé

| Volume mensuel reçu | Coût avant pré-filtre (€) | **Coût avec pré-filtre (€)** | Économie |
|---|---|---|---|
| 100 mails | 0,031 € | **0,011 €** | –0,020 € |
| 1 000 mails | 0,306 € | **0,107 €** | –0,199 € |
| 3 000 mails (Solo) | 0,920 € | **0,322 €** | –0,598 € |
| 10 000 mails (Pro / Business) | 3,060 € | **1,071 €** | –1,989 € |
| 50 000 mails | 15,32 € | **5,355 €** | –9,965 € |
| 100 000 mails | 30,64 € | **10,71 €** | –19,93 € |

### 3.5 Coût des actions IA secondaires — inchangé

Les actions secondaires sont **déclenchées explicitement par l'utilisateur** (clic sur « Générer un brouillon », « Résumer », « Adapter le ton », etc.). Le pré-filtre n'a **aucun effet** sur ces appels. Le tableau ci-dessous est strictement identique à la rev. 3, recalculé depuis la formule `(tokens_in × 0,15 + tokens_out × 0,60) / 1 000 000 × 0,92` :

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

---

## 4. Données de marché — usage réel

**Source factuelle** : Microsoft Work Trend Index Special Report — 17 juin 2025
(Étude basée sur signaux agrégés Microsoft 365 + enquête auprès de 31 000 knowledge workers dans 31 marchés)

- **Employé moyen** : reçoit **117 emails / jour** (donnée publiée par Microsoft)
- Extrapolation interne sur **30 jours calendaires** : ~3 510 mails / mois
  (à pondérer si raisonnement sur jours ouvrés : ~2 500 mails / mois pour ~22 jours ouvrés)
- Repère antérieur sectoriel : ~121 emails / jour

**Hypothèse interne de modélisation (non issue de Microsoft)** :
- La part de mails « actionable » (nécessitant une réponse ou action humaine concrète) est estimée à **~30-40 %** par Inboria, sur la base d'observations terrain et de jugement sectoriel.
- ⚠️ Cette hypothèse est utilisée uniquement pour modéliser l'usage probable des actions IA secondaires (brouillons, relances, résumés). Elle n'est pas fournie par l'étude Microsoft et doit être validée par une mesure interne sur cohorte réelle.

**Implication pour Inboria, post pré-filtre** :
- Sur 100 % des mails reçus → 100 % consomment 1 crédit IA visible (logique inchangée côté client)
- Sur ~35 % de ces mails → l'IA OpenAI est réellement appelée (le pré-filtre absorbe le reste)
- Sur ~35 % supposés « actionable » → l'utilisateur peut déclencher des actions IA secondaires (qui restent factur. au client en crédits si système 13.x activé, ou gratuites en consommation actuelle)

---

## 5. Hypothèses d'usage pour le calcul de marge

**Profil « utilisateur à pleine charge réaliste »** (cas le plus défavorable raisonnable) :

| Variable | Hypothèse |
|---|---|
| Mails reçus & comptés en crédits / mois | 100 % du quota du plan |
| Mails ayant réellement déclenché OpenAI | 35 % des mails reçus (effet pré-filtre) |
| Mails « actionable » (potentiel d'action utilisateur) | 35 % des mails reçus |
| Brouillon IA généré | 50 % des actionables |
| Relance IA générée | 20 % des actionables |
| Résumé conversation | 30 % des actionables |
| Chat support (messages/mois) | ~150 |
| Brief quotidien | 30 × 0,000690 € ≈ 0,021 € / mois |

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
- **Commission variable** : 5 % du montant de la transaction
- **Frais fixe** : 0,50 € par transaction
- Particularité plan **Business** : 1 seule transaction regroupe tous les sièges → le frais fixe de 0,50 € est **mutualisé**

---

## 7. Calcul de marge nette par plan (à pleine charge réaliste, post pré-filtre)

> **Note méthodologique (rev. 4)** : la ligne « Triage IA » utilise désormais le coût moyen pondéré post-filtre de **0,000107 €/mail reçu**. Les autres lignes (actions IA secondaires) utilisent les coûts unitaires inchangés du § 3.5.

### 7.1 Plan Solo — 9 €

| Poste | Calcul | Montant |
|---|---|---|
| Triage IA (3 000 mails reçus, 65 % filtrés) | 3 000 × 0,000107 € | **0,322 €** |
| Brouillons (1 050 × 50 %) | 525 × 0,000428 € | 0,225 € |
| Relances (1 050 × 20 %) | 210 × 0,000331 € | 0,070 € |
| Résumés (1 050 × 30 %) | 315 × 0,000386 € | 0,122 € |
| Chat support | 150 × 0,000221 € | 0,033 € |
| Brief quotidien | 30 × 0,000690 € | 0,021 € |
| **Sous-total OpenAI** | | **0,792 €** *(vs 1,378 € rev. 3)* |
| Paddle | 9 × 5 % + 0,50 € | 0,95 € |
| Infra mutualisée | | 0,15 € |
| **Total coûts directs** | | **1,892 €** |
| **Marge nette** | 9 € − 1,892 € | **7,108 €** |
| **% marge** | | **79 %** *(vs 72 % rev. 3)* |

### 7.2 Plan Pro — 19 €

| Poste | Calcul | Montant |
|---|---|---|
| Triage IA (10 000 mails reçus) | 10 000 × 0,000107 € | **1,071 €** |
| Brouillons (3 500 × 50 %) | 1 750 × 0,000428 € | 0,749 € |
| Relances (3 500 × 20 %) | 700 × 0,000331 € | 0,232 € |
| Résumés (3 500 × 30 %) | 1 050 × 0,000386 € | 0,405 € |
| Chat support | 150 × 0,000221 € | 0,033 € |
| Brief quotidien | 30 × 0,000690 € | 0,021 € |
| **Sous-total OpenAI** | | **2,511 €** *(vs 4,474 € rev. 3)* |
| Paddle | 19 × 5 % + 0,50 € | 1,45 € |
| Infra mutualisée | | 0,15 € |
| **Total coûts directs** | | **4,111 €** |
| **Marge nette** | 19 € − 4,111 € | **14,889 €** |
| **% marge** | | **78 %** *(vs 68 % rev. 3)* |

### 7.3 Plan Business — 9 € / siège (3 sièges minimum)

**Par siège** (équipe de 3 sièges = 27 € total facturés) :

| Poste | Calcul | Montant |
|---|---|---|
| Triage IA (10 000 mails) | 10 000 × 0,000107 € | **1,071 €** |
| Actions IA secondaires (mêmes hypothèses que Pro) | | 1,440 € |
| **Sous-total OpenAI / siège** | | **2,511 €** *(vs 4,474 € rev. 3)* |
| Paddle (mutualisé sur 3 sièges) | (27 × 5 % + 0,50) / 3 | 0,617 € |
| Infra mutualisée | | 0,15 € |
| **Total coûts directs / siège** | | **3,278 €** |
| **Marge nette / siège** | 9 € − 3,278 € | **5,722 €** |
| **% marge** | | **64 %** *(vs 42 % rev. 3)* |

**Évolution de la marge avec la taille de l'équipe** (le frais fixe Paddle de 0,50 € se dilue) :

| Taille équipe | Paddle / siège | Total coûts / siège | Marge / siège | % marge |
|---|---|---|---|---|
| 3 sièges | 0,617 € | 3,278 € | 5,722 € | **64 %** |
| 10 sièges | 0,500 € | 3,161 € | 5,839 € | **65 %** |
| 50 sièges | 0,460 € | 3,121 € | 5,879 € | **65 %** |

→ Le pré-filtre **transforme radicalement l'économie du plan Business** : la marge passe de 42 % à 64 %, alignant Business sur le même profil de marge que Solo et Pro.

---

## 8. Mécanique « Pay-as-you-go » (dépassement de quota)

Lorsqu'un utilisateur dépasse son quota mensuel inclus, chaque crédit supplémentaire est facturé à l'unité, sans plafond et sans interruption de service.

### 8.1 Tarifs actuels du dépassement

| Plan | Prix par crédit au-delà du quota |
|---|---|
| Solo | 0,002 € / crédit |
| Pro | 0,001 € / crédit |
| Business | 0,001 € / crédit |

### 8.2 Calcul de la marge sur dépassement (post pré-filtre)

Coût direct OpenAI moyen par crédit supplémentaire = **0,000107 €** (un mail reçu de plus, dont 65 % seront filtrés).

| Plan | Prix unitaire | Coût OpenAI moyen | **Marge brute / crédit** | **% marge** |
|---|---|---|---|---|
| Solo | 0,002 € | 0,000107 € | **0,001893 €** | **95 %** *(vs 84 % rev. 3)* |
| Pro | 0,001 € | 0,000107 € | **0,000893 €** | **89 %** *(vs 67 % rev. 3)* |
| Business | 0,001 € | 0,000107 € | **0,000893 €** | **89 %** *(vs 67 % rev. 3)* |

### 8.3 Exemples de facturation Pay-as-you-go

**Cas A** — Utilisateur Solo qui reçoit 4 500 mails un mois donné :
- Quota inclus : 3 000 crédits (compris dans les 9 €)
- Dépassement : 1 500 crédits × 0,002 € = **3,00 € supplémentaires**
- Facture totale : 9 € + 3 € = **12 €**
- Coût direct OpenAI sur le dépassement : 1 500 × 0,000107 € = 0,16 €
- Marge brute sur dépassement : **2,84 € (95 %)**

**Cas B** — Utilisateur Pro qui reçoit 15 000 mails un mois (dirigeant très chargé) :
- Quota inclus : 10 000 crédits (compris dans les 19 €)
- Dépassement : 5 000 crédits × 0,001 € = **5,00 € supplémentaires**
- Facture totale : 19 € + 5 € = **24 €**
- Coût direct OpenAI sur le dépassement : 5 000 × 0,000107 € = 0,54 €
- Marge brute sur dépassement : **4,46 € (89 %)**

**Cas C** — Équipe Business de 5 sièges, 1 siège dépasse de 8 000 crédits :
- Quota inclus : 5 × 10 000 = 50 000 crédits (compris dans 5 × 9 € = 45 €)
- Dépassement : 8 000 crédits × 0,001 € = **8,00 € supplémentaires**
- Facture totale : 45 € + 8 € = **53 €**
- Marge brute sur dépassement : 8 € − (8 000 × 0,000107 €) = 8 € − 0,86 € = **7,14 € (89 %)**

### 8.4 Avantages du modèle Pay-as-you-go

1. **Aucune interruption de service** pour le client (pas de blocage à 100 % du quota)
2. **Sécurise la marge** : tout crédit supplémentaire reste rentable (89-95 %, contre 67-84 % avant pré-filtre)
3. **Pousse au bon plan** : si un client dépasse régulièrement, il bascule naturellement vers le plan supérieur (meilleur rapport €/crédits)
4. **Transparence** : prix unitaire affiché clairement à l'inscription

---

## 9. Synthèse rentabilité (rev. 4 — post pré-filtre)

| Plan | Prix | Coûts directs (full usage) | Marge nette | % marge | Δ vs rev. 3 |
|---|---|---|---|---|---|
| Solo | 9 € | 1,892 € | 7,108 € | **79 %** | +7 pts |
| Pro | 19 € | 4,111 € | 14,889 € | **78 %** | +10 pts |
| Business (par siège, 3 sièges) | 9 € | 3,278 € | 5,722 € | **64 %** | **+22 pts** |
| Business (par siège, 10 sièges) | 9 € | 3,161 € | 5,839 € | **65 %** | +22 pts |
| Business (par siège, 50 sièges) | 9 € | 3,121 € | 5,879 € | **65 %** | +21 pts |

**Marge brute moyenne pondérée attendue** (mix hypothétique 60 % Solo / 30 % Pro / 10 % Business) : **≈ 76 %** (vs 66 % rev. 3, soit +10 points).

---

## 10. Points d'attention pour l'auditeur

1. **Vérifier les tarifs OpenAI actuels** sur https://openai.com/api/pricing/ (peuvent évoluer ; OpenAI met aujourd'hui en avant des modèles plus récents type GPT-5, mais Inboria utilise toujours gpt-4o-mini)

2. **Mesurer le taux de filtrage réel en production** : l'hypothèse 65 % est une médiane d'observation. Pour audit définitif, exporter sur 30 jours les compteurs `prefilter_hits + cache_hits` divisé par `prefilter_hits + cache_hits + ai_calls` sur un échantillon ≥ 50 utilisateurs actifs.

3. **Analyse de sensibilité au taux de filtrage** :

   | Hypothèse filtrage | Coût/mail reçu | Marge Solo | Marge Pro | Marge Business |
   |---|---|---|---|---|
   | 50 % (pessimiste) | 0,000153 € | 78 % | 76 % | 60 % |
   | **65 % (retenue)** | **0,000107 €** | **79 %** | **78 %** | **64 %** |
   | 80 % (optimiste) | 0,000061 € | 80 % | 79 % | 67 % |

   → Modèle **robuste** : même à 50 % de filtrage, tous les plans restent à plus de 60 % de marge.

4. **Re-qualifier l'hypothèse 30-40 % « actionable »** : il s'agit d'une hypothèse interne de modélisation Inboria, à valider sur un échantillon réel.

5. **Préciser l'extrapolation 117 mails/jour → mensuel** : 3 510 mails/mois correspond à 30 jours **calendaires**. Sur 22 jours ouvrés, ce serait ~2 500 mails/mois.

6. **Vérifier la grille Paddle** appliquée au compte (5 % + 0,50 € est la grille standard EU ; certains contrats négociés diffèrent).

7. **Coûts Supabase** : susceptibles d'augmenter par paliers (Pro plan à 25 $/mois jusqu'à un certain volume, puis tarifs par compute / stockage / bande passante au-delà).

8. **Fragilité du pré-filtre sur comptes neufs** : le cache `sender_cache` se remplit progressivement (seuil de 3 occurrences avant utilisation). Un nouveau compte aura un taux de filtrage plus proche de 30-40 % les premiers jours, le temps que le cache se constitue. Impact ponctuel sur la marge des nouveaux abonnés (~0,30 € de coût supplémentaire le 1ᵉʳ mois).

9. **Coûts mobiles** : non chiffrés ici (Expo / EAS Build / publication App Store / Google Play). Marginaux mais à intégrer si analyse complète demandée.

10. **Coûts variables OpenAI** : la fourchette par mail (0,00025 € à 0,00040 €) dépend de la longueur réelle du mail. La moyenne 0,00031 € par mail traité (et donc 0,000107 € par mail reçu après filtrage 65 %) est une estimation prudente médiane.

11. **Taux de change USD/EUR** : tous les calculs ci-dessus utilisent **1 USD = 0,92 EUR**. À actualiser à la date de l'audit (BCE de référence).

12. **Dégradation possible du pré-filtre** : si OpenAI dégrade gpt-4o-mini ou si la composition typique des boîtes change (ex. baisse des newsletters, hausse des conversations), le taux de filtrage pourrait baisser. Le monitoring continu via les compteurs est essentiel.

13. **TVA** : non incluse dans les calculs (Paddle gère la TVA via son statut de Merchant of Record, mais les revenus présentés ici sont HT).

---

## 12. Scénario « pire cas réaliste » — abonné qui exploite toutes les fonctions IA

L'objectif est de mesurer **l'exposition maximale d'Inboria** par abonné qui :
1. Reçoit la moyenne Microsoft de **117 mails/jour calendaire** (= 3 510 mails/mois) → 100 % comptés en crédits, dont 35 % seulement déclenchent OpenAI
2. **« joue avec l'app »** : utilise toutes les fonctions IA à un rythme intensif mais plausible

### 12.1 Hypothèses « abuser plausible » (inchangées vs rev. 3)

| Action IA | Hypothèse worst case |
|---|---|
| Mails reçus & comptés (triage + détection RDV combinés) | 100 % des 3 510 mails reçus, dont ~1 229 traités par OpenAI |
| Brouillon IA généré | sur 80 % des mails reçus → 2 808 brouillons |
| Régénération de brouillon | sur 30 % des brouillons → 842 régénérations |
| Adapter le ton (formal / casual / court) | sur 50 % des brouillons → 1 404 variantes |
| Relance IA générée | 5/jour × 30 = 150 |
| Résumé de fil de conversation | sur 50 % des fils → 1 755 |
| Reclassification manuelle (apprentissage) | 20/jour × 30 = 600 |
| Détection RDV manuelle (clic bouton) | 100/mois |
| Chat support intelligent | 30 messages/jour × 30 = 900 |
| Brief quotidien | 30/mois |
| Création projet via IA | 20/mois |
| Catégorisation projet automatique | 100/mois |

### 12.2 Coût OpenAI worst case par mois — recalculé post pré-filtre

⚠️ **Correction d'audit (rev. 4)** : seule la ligne « triage + détection RDV » est affectée par le pré-filtre. Les actions secondaires sont déclenchées explicitement par l'utilisateur — le pré-filtre ne s'applique pas.

| Action | Volume | Coût unitaire (EUR) | **Coût total** |
|---|---|---|---|
| Triage + détection RDV (post-filtre 65 %) | 3 510 reçus → 1 229 traités | 0,000306 € | **0,376 €** *(vs 1,074 € rev. 3)* |
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
| **TOTAL OpenAI worst case** | | | **3,437 €** *(vs 4,135 € rev. 3)* |

### 12.3 Autres coûts directs « pire cas » — inchangés

**Brevo SMTP** (mails sortants envoyés par l'utilisateur) :
- Hypothèse : 50 mails sortants/jour × 30 = 1 500 mails sortants/mois
- Plan Brevo Business 65 €/mois pour 20 000 mails mutualisé = 0,00325 €/mail
- **Coût Brevo / abonné worst case : 1 500 × 0,00325 € ≈ 4,88 €**

**Supabase** (DB + auth + storage), pire cas dilution faible (100 abonnés actifs) :
- Plan Pro 25 $/mois (~23 €) base + compute add-on micro 10 $/mois éventuel
- Stockage emails (corpus ~18 MB/abonné/mois) : négligeable
- Egress (transfert) : ~0,12 $/mois
- **Worst case par abonné (100 abonnés) : ~1,00 €** ; à 1 000 abonnés : ~0,10 €

**Replit hébergement** :
- Reserved VM Hacker plan + Deployment + Membership ≈ 60 $/mois (~55 €) mutualisé
- À 100 abonnés : **0,55 €** ; à 500 : 0,11 € ; à 1 000 : 0,055 €

**Paddle** : identique aux sections précédentes.

### 12.4 Synthèse pire cas par plan (à 100 abonnés actifs = early stage)

#### Plan Solo « abuser » (9 €/mois)

L'abuser dépasse le quota Solo (3 000 crédits) → 510 crédits PAYG × 0,002 € = **1,02 € de revenu supplémentaire**.

| Poste | Montant |
|---|---|
| Revenu (9 € + dépassement 1,02 €) | **10,02 €** |
| OpenAI worst case (post-filtre) | 3,437 € |
| Brevo | 4,88 € |
| Supabase (100 abonnés) | 1,00 € |
| Replit (100 abonnés) | 0,55 € |
| Paddle (2 transactions) | 2,00 € |
| **Total coûts directs** | **11,867 €** |
| **Marge nette** | **−1,847 € ⚠️ PERTE** *(vs −2,545 € rev. 3, soit +0,70 €)* |

#### Plan Pro « abuser » (19 €/mois)

L'abuser reste sous le quota Pro (10 000 crédits), pas de dépassement.

| Poste | Montant |
|---|---|
| Revenu | **19,00 €** |
| OpenAI worst case | 3,437 € |
| Brevo | 4,88 € |
| Supabase | 1,00 € |
| Replit | 0,55 € |
| Paddle | 1,45 € |
| **Total coûts directs** | **11,317 €** |
| **Marge nette** | **+7,683 € (40 %)** ✅ *(vs +6,985 € / 37 % rev. 3)* |

#### Plan Business « abuser » (9 €/siège, 3 sièges)

Chaque siège = même profil abuser que Pro.

| Poste / siège | Montant |
|---|---|
| Revenu / siège | **9,00 €** |
| OpenAI worst case | 3,437 € |
| Brevo | 4,88 € |
| Supabase | 1,00 € |
| Replit | 0,55 € |
| Paddle / siège | 0,617 € |
| **Total coûts directs / siège** | **10,484 €** |
| **Marge nette / siège** | **−1,484 € ⚠️ PERTE** *(vs −2,185 € rev. 3, soit +0,70 €)* |

### 12.5 Conclusion sur le pire cas

| Plan | Marge worst case « 100 abonnés » | Verdict |
|---|---|---|
| Solo | **−1,847 €** | ⚠️ Toujours déficitaire si user abuse, mais réduit de 27 % |
| Pro | **+7,683 €** (40 %) | ✅ Reste rentable, marge améliorée |
| Business / siège | **−1,484 €** | ⚠️ Toujours déficitaire à 9 €/siège, mais réduit de 32 % |

**Diagnostic** : le pré-filtre **améliore le pire cas** sur tous les plans (gain de ~0,70 €/abonné), mais ne résout **pas** la vulnérabilité structurelle de Solo et Business à 9 €. La cause racine est inchangée : **Brevo (4,88 €) reste le 2ᵉ poste de coût et n'est pas plafonné**.

**Risques persistants** :
1. Le **Pay-as-you-go actuel ne couvre que les mails entrants**, pas les mails envoyés via Brevo ni les actions IA secondaires
2. Les **mails sortants Brevo** restent le poste de coût non plafonné le plus exposé
3. **Solo et Business à 9 €** restent **structurellement vulnérables** à un usage abusif intensif

→ La recommandation du § 13 (système de crédits étendu à tous les coûts directs, dont Brevo) **reste valide et nécessaire**, indépendamment du pré-filtre.

---

## 13. Recommandation : système de crédits IA — deux variantes stratégiques

### 13.1 État actuel (livré en production)

Le **renommage** « quotas emails » → **« crédits IA »** est en production. La logique sous-jacente reste **« 1 mail reçu = 1 crédit consommé »** — c'est ce qu'on appellera la **Variante A**. Cette section présente cette variante, puis une **Variante B** plus ambitieuse qui exploite pleinement le pré-filtre comme argument commercial.

### 13.2 Barème de crédits proposé (commun aux deux variantes)

Unité de base : **1 crédit = coût de référence d'un mail reçu pré-filtre = 0,000306 €** (coût d'un mail effectivement traité par l'IA, pas le coût moyen pondéré). Ce choix garantit que même les actions IA secondaires sont couvertes.

| Action | Crédits | Coût direct (€) | Couverture (crédits × 0,000306 €) |
|---|---|---|---|
| Mail entrant analysé (triage + RDV) — Variante A | **1** | 0,000107 € moyen | 0,000306 € ✅ |
| Mail entrant analysé (triage + RDV) — Variante B | **1** *(uniquement si IA appelée)* | 0,000306 € | 0,000306 € ✅ |
| Brouillon IA généré | **2** | 0,000428 € | 0,000612 € ✅ |
| Régénération de brouillon | **2** | 0,000428 € | 0,000612 € ✅ |
| Variante de ton | **1** | 0,000276 € | 0,000306 € ✅ |
| Relance IA générée | **2** | 0,000331 € | 0,000612 € ✅ |
| Résumé de fil de conversation | **2** | 0,000386 € | 0,000612 € ✅ |
| Reclassification manuelle | **1** | 0,000207 € | 0,000306 € ✅ |
| Détection RDV manuelle | **gratuit** | 0,000099 € | absorbé |
| Chat support intelligent (1 message) | **1** | 0,000221 € | 0,000306 € ✅ |
| Brief quotidien (1×/j max) | **gratuit** | 0,000690 € | mutualisé / produit d'appel |
| Création projet via IA | **2** | 0,000428 € | 0,000612 € ✅ |
| Catégorisation projet automatique | **1** | 0,000207 € | 0,000306 € ✅ |
| **Mail envoyé via Brevo** | **10** | **0,003 € (SMTP)** | **0,00306 € ✅** |
| Lecture, recherche, tri, ouverture | **gratuit** | 0 € | aucun coût direct |

### 13.3 Variante A — « 1 crédit = 1 mail reçu » (livré aujourd'hui)

**Mécanique** : chaque mail entrant consomme 1 crédit, qu'il ait été filtré ou traité par l'IA. Logique inchangée vs avant pré-filtre.

**Conséquences** :
- ✅ Aucun changement backend (déjà en production)
- ✅ Rétrocompatibilité totale : 1 ancien quota = 1 nouveau crédit
- ✅ Marge supplémentaire (+10 pts en moyenne) encaissée silencieusement
- ❌ L'utilisateur ne perçoit **aucune valeur** du pré-filtre
- ❌ Difficile de justifier les prix face à un concurrent qui annoncerait « X mails IA » avec un volume comparable
- ❌ Aucun argument marketing différenciant tiré de l'optimisation

**Prix conservés** : Solo 3 000 / Pro 10 000 / Business 10 000 par siège.

### 13.4 Variante B — « 1 crédit = 1 traitement IA réel » (recommandée)

**Mécanique** : un mail reçu ne consomme un crédit que **si** OpenAI est réellement appelé. Si le pré-filtre attrape le mail (65 % des cas), **aucun crédit n'est décompté**.

**Conséquences immédiates pour l'utilisateur** :
- 3 000 crédits Solo couvrent en moyenne **~8 570 mails reçus**
- 10 000 crédits Pro couvrent en moyenne **~28 570 mails reçus**
- 10 000 crédits Business / siège couvrent **~28 570 mails reçus / siège**

**Argument commercial** :
> *« Avec Inboria, vous ne payez que le travail réel de l'IA. Notre filtre intelligent élimine en amont le bruit (newsletters, automates, no-reply) — vous économisez en moyenne 65 % de vos crédits. Concrètement, votre plan Solo à 9 € traite jusqu'à ~8 500 emails reçus par mois. »*

**Implications backend** (1 demi-journée de dev) :
- Modifier `consumeCreditsForIncoming(userId, prefilterResult)` : si `prefilterResult.hit === true`, ne pas incrémenter `emails_used`
- Nouveau champ d'affichage sur la page Abonnement : « X crédits utilisés sur Y mails reçus → économie de Z % grâce au filtre intelligent »
- Webhook Paddle / facture inchangé

**Marge** : identique à la Variante A pour Inboria (le coût direct ne dépend pas de la définition d'un crédit, seulement du volume réel d'appels IA), mais perception de valeur ×2,5 à 3 côté client.

**Pricing** : conserver 9 € / 19 € / 9 € à 12,99 € selon décision § 14.

### 13.5 Pay-as-you-go en crédits (les deux variantes)

Contrairement au PAYG actuel (qui ne facture que les mails entrants au-delà du quota), le PAYG en crédits couvre **toutes les actions consommatrices** dès que le solde est épuisé :

- ✅ Triage entrant supplémentaire (1 crédit)
- ✅ Brouillons, régénérations, variantes de ton
- ✅ Relances, résumés
- ✅ Reclassifications, catégorisation projets
- ✅ Messages chat support
- ✅ Création de projets via IA
- ✅ **Mails envoyés via Brevo (10 crédits / envoi)** — **clé pour fermer la fuite identifiée au § 12**

Tarif PAYG :
- **Pack pré-acheté : 5 000 crédits = 4,90 €** (≈ 0,00098 €/crédit)
- **Dépassement automatique au compteur (sans pack) : 0,0012 €/crédit**

→ La marge sur PAYG passe de 67-84 % (rev. 3) à **>90 %** sur tous les plans grâce au pré-filtre.

### 13.6 Recommandation finale

**Implémenter la Variante B + PAYG étendu en crédits** :
1. Différenciateur marketing fort, immédiatement vérifiable côté client
2. Justifie le maintien des prix face aux concurrents
3. Ferme la fuite Brevo (4,88 €/abonné worst case) en intégrant les envois au PAYG
4. Effort dev estimé : **3 à 5 jours** (logique consommation + UI Abonnement + page packs + webhook Paddle)

---

## 14. Business plan — rentabilité par plan et fixation des prix

### 14.1 Trois profils d'abonnés modélisés

| Profil | % typique | Mails reçus/mois | % envoi | Envois/mois | Usage IA secondaire |
|---|---|---|---|---|---|
| **Light** (freelance occasionnel) | ~50 % | 900 (30/j) | 10 % | 90 | faible (5 % brouillons IA) |
| **Median** (pro chargé) | ~35 % | 2 400 (80/j) | 20 % | 480 | modéré (50 % brouillons) |
| **Heavy** (dirigeant) | ~15 % | 3 510 (117/j) | 30 % | 1 050 | intensif (cf. § 13.4) |

### 14.2 Crédits consommés par profil (Variante A : 1 mail reçu = 1 crédit)

| Profil | Crédits/mois |
|---|---|
| Light | **2 311** |
| Median | **9 274** |
| Heavy | **18 279** |

(Détails de calcul identiques à rev. 3 § 14.2.)

### 14.3 Coûts directs variables par profil — recalculés post pré-filtre

OpenAI triage post-filtre = mails reçus × 0,000107 €. Actions IA secondaires inchangées.

| Profil | OpenAI triage (post-filtre) | OpenAI actions secondaires | OpenAI total | Brevo | **Total variable** |
|---|---|---|---|---|---|
| Light | 0,096 € | ~0,21 € | 0,31 € | 0,27 € | **0,58 €** *(vs 0,67 € rev. 3)* |
| Median | 0,257 € | ~0,93 € | 1,18 € | 1,44 € | **2,62 €** *(vs 2,63 €)* |
| Heavy | 0,376 € | ~3,06 € | 3,44 € | 3,15 € | **6,59 €** *(vs 5,15 €)* |

> Note : le profil Heavy de § 14 est plus intensif (80 % brouillons sur tous les mails reçus dans la version § 12) que celui de § 13.4 (50 % d'envois). Les valeurs ci-dessus reprennent l'hypothèse § 12 stricte ; les calculs du § 13.4 utilisent une variante mixte plus conservatrice.

### 14.4 Marge unitaire par combinaison profil × plan (post pré-filtre)

Hypothèses : infra mutualisée à 100 abonnés (Supabase 1,00 € + Replit 0,55 € = 1,55 €/abonné). Paddle = 5 % + 0,50 € par transaction, mutualisé sur les sièges Business.

#### Plan SOLO — 9 € / 3 000 crédits (Variante A)

| Profil | Crédits | Dépassement | Revenu PAYG | Revenu | Coûts | **Marge** | **%** |
|---|---|---|---|---|---|---|---|
| Light | 2 311 | 0 | 0 € | **9,00 €** | 0,58 + 1,55 + 0,95 = 3,08 € | **+5,92 €** | **66 %** ✅ |
| Median | 9 274 → +6 274 | 12,55 € *(PAYG 0,002 €)* | 12,55 € | **21,55 €** | 2,62 + 1,55 + 1,83 = 6,00 € | **+15,55 €** | **72 %** ✅ |
| Heavy | 18 279 → +15 279 | 30,56 € | 30,56 € | **39,56 €** | 6,59 + 1,55 + 2,53 = 10,67 € | **+28,89 €** | **73 %** ✅ |

> Note : avec la Variante B, le profil Heavy ne consomme que ~6 400 crédits (35 % × 18 279) → Solo couvre 35 % des mails sans dépassement, mais les actions secondaires explicites restent comptées. PAYG et marges similaires.

#### Plan PRO — 19 € / 10 000 crédits

| Profil | Crédits | Dépassement | Revenu PAYG | Revenu | Coûts | **Marge** | **%** |
|---|---|---|---|---|---|---|---|
| Light | 2 311 (sous quota) | 0 | 0 € | **19,00 €** | 0,58 + 1,55 + 1,45 = 3,58 € | **+15,42 €** | **81 %** ⚠️ surpayé |
| Median | 9 274 (sous quota) | 0 | 0 € | **19,00 €** | 2,62 + 1,55 + 1,45 = 5,62 € | **+13,38 €** | **70 %** ✅ |
| Heavy | 18 279 → +8 279 | 9,93 € | 9,93 € | **28,93 €** | 6,59 + 1,55 + 2,45 = 10,59 € | **+18,34 €** | **63 %** ✅ |

#### Plan BUSINESS — 9 € / siège / 10 000 crédits / siège (équipe 3 sièges)

Paddle/siège abonnement : (3 × 9 × 5 % + 0,50) / 3 = **0,617 €/siège**.

| Profil / siège | Crédits | Dépassement | Revenu PAYG | Revenu/siège | Coûts/siège | **Marge/siège** | **%** |
|---|---|---|---|---|---|---|---|
| Light | 2 311 | 0 | 0 € | **9,00 €** | 0,58 + 1,55 + 0,617 = 2,75 € | **+6,25 €** | **70 %** ✅ |
| Median | 9 274 | 0 | 0 € | **9,00 €** | 2,62 + 1,55 + 0,617 = 4,79 € | **+4,21 €** | **47 %** ✅ |
| Heavy | 18 279 → +8 279 | 9,93 € | 9,93 € | **18,93 €** | 6,59 + 1,55 + 1,28 = 9,42 € | **+9,51 €** | **50 %** ✅ |

→ Tous les couples profil × plan sont **rentables** post pré-filtre, marge minimale **47 %** (Business median).

### 14.5 Diagnostic des prix actuels — révisé post pré-filtre

| Plan | Prix actuel | Marge min. (rev. 4) | Marge min. (rev. 3) | Diagnostic |
|---|---|---|---|---|
| **Essai** | gratuit | n/a | n/a | Conserver |
| **Solo** | 9 € | 66 % | 65 % | Sweet spot, conserver |
| **Pro** | 19 € | 63 % | 64 % | Conserver |
| **Business** | **9 €/siège** | **47 %** | 47 % rev. 3 (avec hausse à 12,99 € envisagée pour atteindre 62 %) | **Réévaluer : 9 € ou 12,99 €** ? |

**Question stratégique sur Business** :

| Option | Marge min. profile median | Marge max. profile heavy | Avantage |
|---|---|---|---|
| **Maintenir 9 €/siège** | 47 % | 50 % | Prix d'attaque le plus compétitif sur le segment équipes ; le pré-filtre rend le prix **soutenable** sans déformation |
| **Monter à 12,99 €/siège** | 62 % (cible originale) | 64 % | Aligne Business sur Pro en marge ; manque à gagner annuel (1 000 abonnés, 150 sièges) : **~7 200 €** vs 9 € |

**Recommandation rev. 4** : **conserver Business à 9 €/siège**. Le pré-filtre suffit à rendre le plan structurellement rentable (47-50 % vs 42 % avant). Garder un prix d'attaque agressif sur le segment équipe est plus précieux pour l'acquisition que les 22 pts de marge supplémentaires d'une montée à 12,99 €.

### 14.6 Projection à l'échelle (mix d'abonnés réaliste)

Distribution sur 100 abonnés payants (mêmes hypothèses qu'en rev. 3) :
- **55 Solo** (40 light + 15 median)
- **30 Pro** (20 median + 10 heavy)
- **15 sièges Business** (5 équipes de 3, profil heavy)

#### Marge mensuelle agrégée par palier d'échelle (Business à 9 €/siège)

| Palier | Infra/abonné | Marge Solo (×55) | Marge Pro (×30) | Marge Business (×15 sièges) | **Marge brute/mois** | **MRR** |
|---|---|---|---|---|---|---|
| **100 abonnés** | 1,55 € | 55 × 8,55 € = 470 € | 30 × 16,99 € = 510 € | 15 × 9,51 € = 143 € | **1 123 €** | ~2 685 € |
| **500 abonnés** (×5) | 0,31 € | 275 × 9,79 € = 2 692 € | 150 × 18,23 € = 2 735 € | 75 × 10,75 € = 806 € | **6 233 €** | ~13 425 € |
| **1 000 abonnés** | 0,155 € | 550 × 9,95 € = 5 472 € | 300 × 18,39 € = 5 517 € | 150 × 10,91 € = 1 636 € | **12 625 €** | ~26 850 € |
| **5 000 abonnés** | 0,031 € | 2 750 × 10,07 € = 27 692 € | 1 500 × 18,51 € = 27 765 € | 750 × 11,03 € = 8 273 € | **63 730 €** | ~134 250 € |

*Marge Solo : moyenne pondérée light/median ; Pro : moyenne median/heavy ; Business : profil heavy moyen.*

#### Marge nette annuelle (après bénéfice)

| Palier | Marge brute annuelle | CAC estimé (15 €/abonné × 50 % churn) | **Bénéfice net annuel estimé** |
|---|---|---|---|
| 100 abonnés | 13 476 € | ~750 € | **~12 700 €** |
| 500 abonnés | 74 796 € | ~3 750 € | **~71 050 €** |
| 1 000 abonnés | 151 500 € | ~7 500 € | **~144 000 €** |
| 5 000 abonnés | 764 760 € | ~37 500 € | **~727 250 €** |

→ Gain de marge annuelle vs rev. 3 (qui projetait 142 000 € à 1 000 abonnés) : **+2 000 € à 1 000 abonnés**, **+10 000 € à 5 000 abonnés**, principalement dû à la chute du coût triage. Effet modeste car le triage n'était déjà qu'une partie du coût total.

### 14.7 Scénarios alternatifs — sensibilité au pricing

#### Scénario 1 (recommandé) : tarification actuelle conservée (9 / 19 / 9)

- MRR à 1 000 abonnés : ~26 850 €/mois
- Marge brute : 12 625 €/mois (47 % du MRR)
- Marge brute annuelle : ~151 500 €
- Décision : **modèle viable et compétitif**. Le pré-filtre rend Business à 9 €/siège structurellement rentable, plus besoin de monter à 12,99 €.

#### Scénario 2 : Business monté à 12,99 €/siège

- Marge Business heavy : 13,82 €/siège (+4,31 € vs 9 €)
- Gain annuel à 1 000 abonnés (150 sièges Business) : **~7 760 €/an**
- Risque : perte de compétitivité sur le segment équipes (concurrents directs autour de 8-12 €/siège)
- Décision : **non recommandé** sauf si traction Business inférieure aux attentes (autour de 5 % du mix)

#### Scénario 3 : ajout d'un plan « Starter » à 5 €/1 500 crédits

- Cible : light users qui trouvent Solo trop cher
- Marge unitaire post-filtre : 5 − (0,30 + 1,55 + 0,75) = **2,40 € (48 %)**
- Risque : cannibalisation de Solo. À ne lancer que si le churn Solo light dépasse 20 %.

#### Scénario 4 : pricing annuel −20 %

- Solo annuel : 86 €/an / Pro annuel : 182 €/an / Business annuel : 86 €/siège/an
- Avantage : engagement annuel réduit le churn (LTV ×3), Paddle facturé 1×/an (économise 11 frais fixes 0,50 €)
- **Recommandation forte** : ajouter le pricing annuel dès maintenant

### 14.8 Conclusion business plan rev. 4

| Question | Réponse |
|---|---|
| Chaque plan est-il rentable ? | **Oui** — marge minimale **47 %** (Business median), maximale **81 %** (Pro light) |
| Tarification recommandée | **Solo 9 € / Pro 19 € / Business 9 €/siège** (inchangée — le pré-filtre rend la montée à 12,99 € **non nécessaire**) |
| Seuil de rentabilité opérationnelle | Atteint dès **~50 abonnés payants** |
| Objectif MRR pour viabilité salaire fondateur (3 000 €/mois net) | **~250 abonnés payants** mix actuel |
| Objectif MRR pour viabilité équipe (10 000 €/mois) | **~800 abonnés payants** |
| Variante de crédits recommandée | **Variante B** (1 crédit = 1 IA réelle) — argument marketing décisif |
| Levier prioritaire de marge restant | **PAYG étendu en crédits incluant Brevo (10 crédits/envoi)** + pricing annuel −20 % |

---

## 11. Sources

- OpenAI Pricing : https://openai.com/api/pricing/
- Microsoft Work Trend Index 2025 : https://news.microsoft.com/de-ch/2025/06/17/new-microsoft-study-reveals-the-rise-of-the-infinite-workday-40-of-employees-check-email-before-6-a-m-evening-meetings-up-16/
- Microsoft Worklab : https://www.microsoft.com/en-us/worklab/work-trend-index/breaking-down-infinite-workday
- Paddle Pricing : https://www.paddle.com/pricing
- Supabase Pricing : https://supabase.com/pricing
- Brevo Pricing : https://www.brevo.com/pricing/
- Code source pré-filtre Inboria : `artifacts/api-server/src/services/pre-filter.ts`

---

*Fin du document — révision 4.*
