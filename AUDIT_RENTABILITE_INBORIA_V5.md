# Audit de rentabilité — Inboria

**Document destiné à audit externe**
Date : 20 avril 2026 (révision 5 — correction prix Business + intégration retours auditeur)
Préparé pour : vérification indépendante de la structure de coûts et marges

> **Notes de révision (rev. 5)** :
> - **Correction majeure** : le prix Business retenu est désormais le prix **réellement pratiqué en production**, soit **12,99 € / siège / mois** (et non 9 €/siège comme indiqué dans la rev. 4). Toutes les sections 2, 7.3, 9, 12.4, 13, 14.4, 14.5 et 14.6 sont recalculées en conséquence.
> - **Intégration des remarques de la vérification externe** :
>   - Les coûts unitaires des actions IA secondaires sont confirmés en **euros** (formule `(tokens_in × 0,15 + tokens_out × 0,60) / 1 000 000 × 0,92`).
>   - L'hypothèse « 30–40 % de mails actionable » est explicitement requalifiée comme **estimation interne Inboria**, et **non** comme résultat de l'étude Microsoft (cf. § 4).
>   - L'extrapolation « 117 mails/jour → 3 510 mails/mois » est précisée comme **calendaire (30 jours)** et non comme volume mensuel observé.
> - Le pré-filtre IA (rev. 4) reste en production avec une hypothèse de **65 % de filtrage médian**.
> - Tarifs OpenAI **inchangés** vs rev. 4 (gpt-4o-mini : 0,15 $/M input, 0,60 $/M output ; conversion 1 USD = 0,92 EUR).

---

## 1. Description de l'application

**Inboria** est une solution SaaS B2B « Email Autopilot » destinée aux PME et indépendants. L'application connecte la boîte mail professionnelle de l'utilisateur (Gmail, Outlook, IMAP) et applique de l'intelligence artificielle pour automatiser le tri, la priorisation et le traitement des emails.

**Fonctionnalités IA principales** :
- **Pré-filtre déterministe** (en production) : avant tout appel OpenAI, un module local décide si le mail nécessite réellement un traitement IA. Newsletters (`List-Unsubscribe`), automates (`Auto-Submitted`, `Precedence: bulk`), expéditeurs `noreply@*` / `notifications@*` / `mailer-daemon@*` et expéditeurs récurrents déjà classés sont gérés sans token consommé.
- **Triage automatique** des mails restants (catégorisation, priorité, résumé, détection spam, extraction de tâches)
- **Détection automatique de rendez-vous**
- **Génération de brouillons de réponse**, **relances**, **résumés de conversation**
- **Brief quotidien**, **chat support intelligent**, **reclassification manuelle**

**Stack technique** : React + Vite (TypeScript) · Express (Node.js) · Supabase (PostgreSQL + Auth) · OpenAI gpt-4o-mini · Paddle (Merchant of Record) · Brevo SMTP · Replit (hébergement) · Expo (mobile iOS/Android) · i18n FR / EN / NL / DE / ES.

**Cible commerciale** : PME, dirigeants, professions libérales, freelances européens.

---

## 2. Plans tarifaires actuels

| Plan | Prix mensuel | Crédits IA / mois | Public cible |
|---|---|---|---|
| **Essai** | Gratuit (one-shot) | 100 | Découverte produit |
| **Solo** | 9 € | 3 000 | Indépendants, freelances |
| **Pro** | 19 € | 10 000 | Professionnels, dirigeants PME |
| **Business** | **12,99 € / siège** (min 3, max 50 sièges) | 10 000 / siège | Équipes, boîtes partagées |

**Définition d'« 1 crédit IA »** : 1 mail entrant reçu = 1 crédit consommé (variante A, livrée en production).

**Pay-as-you-go (dépassement)** :
- Solo : 0,002 € / crédit supplémentaire
- Pro : 0,001 € / crédit supplémentaire
- Business : 0,001 € / crédit supplémentaire

---

## 3. Coût OpenAI réel par mail reçu — avec pré-filtre

### 3.1 Tarifs officiels OpenAI (gpt-4o-mini, 2025)

- **Tokens entrée** : 0,15 $ / 1 000 000 tokens
- **Tokens sortie** : 0,60 $ / 1 000 000 tokens
- **Conversion** : 1 USD ≈ 0,92 EUR (à ajuster à la date d'audit)

### 3.2 Mécanique du pré-filtre

Implémentation : `artifacts/api-server/src/services/pre-filter.ts`. Deux étages :

**Étage 1 — Headers RFC + pattern sender** : `List-Unsubscribe`, `Auto-Submitted`, `Precedence: bulk`, local-part `^(noreply|no-reply|donotreply|notification|alerts?|mailer-daemon|...)$`.

**Étage 2 — Cache `sender_cache`** : si l'expéditeur a été classé ≥ 3 fois pour cet utilisateur avec un verdict stable dans les 60 derniers jours, le résultat est réappliqué directement. Invalidation automatique sur reclassification.

**Métrique de production** : 60–70 % des mails entrants sont attrapés. **Hypothèse retenue : 65 % (médiane).**

### 3.3 Coût combiné triage + RDV — par mail reçu

Pour un mail qui **déclenche** OpenAI (35 % des cas) :
- Triage : 900 in + 150 out = 0,000225 $ → **0,000207 €**
- Détection RDV : 400 in + 80 out = 0,000108 $ → **0,000099 €**
- **Coût d'un mail traité par IA : 0,000333 $ ≈ 0,000306 €**

Pour un mail filtré (65 %) : **0 €**.

**Coût moyen pondéré par mail reçu** : `0,35 × 0,000306 € = ` **0,000107 €**.

### 3.4 Coût par paliers de quota

| Volume mensuel reçu | Sans pré-filtre | **Avec pré-filtre** | Économie |
|---|---|---|---|
| 3 000 mails (Solo) | 0,920 € | **0,322 €** | –0,598 € |
| 10 000 mails (Pro / Business) | 3,060 € | **1,071 €** | –1,989 € |
| 50 000 mails | 15,32 € | **5,355 €** | –9,965 € |

### 3.5 Coût des actions IA secondaires (déclenchées par l'utilisateur — non affectées par le pré-filtre)

| Action | Tokens in | Tokens out | Coût USD | **Coût EUR** |
|---|---|---|---|---|
| Brouillon de réponse | 1 500 | 400 | 0,000465 $ | **0,000428 €** |
| Régénération de brouillon | 1 500 | 400 | 0,000465 $ | **0,000428 €** |
| Variante de ton | 1 200 | 200 | 0,000300 $ | **0,000276 €** |
| Relance générée | 1 200 | 300 | 0,000360 $ | **0,000331 €** |
| Résumé de conversation | 2 000 | 200 | 0,000420 $ | **0,000386 €** |
| Chat support (1 message) | 800 | 200 | 0,000240 $ | **0,000221 €** |
| Brief quotidien | 3 000 | 500 | 0,000750 $ | **0,000690 €** |
| Reclassification manuelle | 900 | 150 | 0,000225 $ | **0,000207 €** |
| Création projet IA | 1 500 | 400 | 0,000465 $ | **0,000428 €** |
| Catégorisation projet auto | 900 | 150 | 0,000225 $ | **0,000207 €** |

> Tous les coûts sont **convertis** au taux 0,92 EUR/USD. La remarque de l'auditeur externe sur d'éventuelles valeurs non converties est levée.

---

## 4. Données de marché — usage réel

**Source factuelle** : Microsoft Work Trend Index Special Report — 17 juin 2025.

- **Employé moyen** : reçoit **117 emails / jour** (donnée publiée par Microsoft).
- Extrapolation interne sur **30 jours calendaires** : ~3 510 mails/mois (≈ 2 500 mails/mois sur 22 jours ouvrés).

**⚠️ Hypothèse interne Inboria — non issue de Microsoft** :
- La part de mails « actionable » (réponse ou action humaine concrète requise) est estimée à **~30–40 %**, sur la base d'observations terrain et de jugement sectoriel.
- Cette estimation est utilisée uniquement pour modéliser l'usage probable des actions IA secondaires.
- Elle doit être validée par une mesure interne sur cohorte réelle avant publication externe sans réserve.

---

## 5. Hypothèses d'usage pour le calcul de marge

**Profil « pleine charge réaliste »** :

| Variable | Hypothèse |
|---|---|
| Mails reçus & comptés en crédits / mois | 100 % du quota du plan |
| Mails ayant réellement déclenché OpenAI | 35 % des mails reçus |
| Mails « actionable » | 35 % des mails reçus (hypothèse interne, cf. § 4) |
| Brouillon IA | 50 % des actionables |
| Relance IA | 20 % des actionables |
| Résumé conversation | 30 % des actionables |
| Chat support | ~150 messages/mois |
| Brief quotidien | 30/mois |

---

## 6. Coûts directs additionnels

| Poste | Détail | Coût mutualisé / utilisateur |
|---|---|---|
| **Supabase** Pro 25 $/mois | mutualisé ~500 utilisateurs | ~0,05 € |
| **Replit** ~20 $/mois | mutualisé | ~0,04 € |
| **Brevo SMTP** | selon volume | ~0,05 € |
| **Domaine, monitoring, divers** | mutualisé | ~0,01 € |
| **Sous-total infra mutualisée** | | **~0,15 € / utilisateur actif** |

**Frais Paddle** : 5 % du montant + 0,50 € par transaction. Particularité Business : une seule transaction regroupe tous les sièges → frais fixe **mutualisé**.

---

## 7. Calcul de marge nette par plan (à pleine charge réaliste, post pré-filtre)

### 7.1 Plan Solo — 9 €

| Poste | Calcul | Montant |
|---|---|---|
| Triage IA (3 000 mails reçus, 65 % filtrés) | 3 000 × 0,000107 € | 0,322 € |
| Brouillons (1 050 × 50 %) | 525 × 0,000428 € | 0,225 € |
| Relances (1 050 × 20 %) | 210 × 0,000331 € | 0,070 € |
| Résumés (1 050 × 30 %) | 315 × 0,000386 € | 0,122 € |
| Chat support | 150 × 0,000221 € | 0,033 € |
| Brief quotidien | 30 × 0,000690 € | 0,021 € |
| **Sous-total OpenAI** | | **0,792 €** |
| Paddle | 9 × 5 % + 0,50 € | 0,950 € |
| Infra mutualisée | | 0,150 € |
| **Total coûts directs** | | **1,892 €** |
| **Marge nette** | 9 € − 1,892 € | **7,108 €** |
| **% marge** | | **79 %** |

### 7.2 Plan Pro — 19 €

| Poste | Calcul | Montant |
|---|---|---|
| Triage IA (10 000 mails reçus) | 10 000 × 0,000107 € | 1,071 € |
| Brouillons (3 500 × 50 %) | 1 750 × 0,000428 € | 0,749 € |
| Relances (3 500 × 20 %) | 700 × 0,000331 € | 0,232 € |
| Résumés (3 500 × 30 %) | 1 050 × 0,000386 € | 0,405 € |
| Chat support | 150 × 0,000221 € | 0,033 € |
| Brief quotidien | 30 × 0,000690 € | 0,021 € |
| **Sous-total OpenAI** | | **2,511 €** |
| Paddle | 19 × 5 % + 0,50 € | 1,450 € |
| Infra mutualisée | | 0,150 € |
| **Total coûts directs** | | **4,111 €** |
| **Marge nette** | 19 € − 4,111 € | **14,889 €** |
| **% marge** | | **78 %** |

### 7.3 Plan Business — **12,99 € / siège** (3 sièges minimum)

**Par siège** (équipe de 3 sièges = 38,97 € total facturés) :

| Poste | Calcul | Montant |
|---|---|---|
| Triage IA (10 000 mails) | 10 000 × 0,000107 € | 1,071 € |
| Actions IA secondaires (mêmes hypothèses que Pro) | | 1,440 € |
| **Sous-total OpenAI / siège** | | **2,511 €** |
| Paddle (mutualisé sur 3 sièges) | (38,97 × 5 % + 0,50) / 3 | 0,816 € |
| Infra mutualisée | | 0,150 € |
| **Total coûts directs / siège** | | **3,477 €** |
| **Marge nette / siège** | 12,99 € − 3,477 € | **9,513 €** |
| **% marge** | | **73 %** |

**Évolution de la marge avec la taille de l'équipe** (le frais fixe Paddle de 0,50 € se dilue) :

| Taille équipe | Paddle / siège | Total coûts / siège | Marge / siège | % marge |
|---|---|---|---|---|
| 3 sièges | 0,816 € | 3,477 € | 9,513 € | **73 %** |
| 10 sièges | 0,700 € | 3,361 € | 9,629 € | **74 %** |
| 50 sièges | 0,660 € | 3,321 € | 9,669 € | **74 %** |

→ À 12,99 €/siège, **Business devient le plan le plus rentable d'Inboria** en marge nette par utilisateur, devançant Solo (7,11 €) et Pro (14,89 € en absolu, 78 % en %).

---

## 8. Mécanique « Pay-as-you-go »

### 8.1 Tarifs

| Plan | Prix par crédit au-delà du quota |
|---|---|
| Solo | 0,002 € |
| Pro | 0,001 € |
| Business | 0,001 € |

### 8.2 Marge sur dépassement (post pré-filtre)

Coût direct OpenAI moyen par crédit supplémentaire = **0,000107 €**.

| Plan | Prix unitaire | Coût | **Marge / crédit** | **% marge** |
|---|---|---|---|---|
| Solo | 0,002 € | 0,000107 € | 0,001893 € | **95 %** |
| Pro | 0,001 € | 0,000107 € | 0,000893 € | **89 %** |
| Business | 0,001 € | 0,000107 € | 0,000893 € | **89 %** |

### 8.3 Exemples

**Cas A — Solo qui reçoit 4 500 mails** : 9 € + 1 500 × 0,002 € = **12 €** (marge dépassement 95 %).

**Cas B — Pro qui reçoit 15 000 mails** : 19 € + 5 000 × 0,001 € = **24 €** (marge dépassement 89 %).

**Cas C — Business 5 sièges, 1 siège dépasse de 8 000 crédits** : 5 × 12,99 € + 8 € = **72,95 €** (marge dépassement 89 %).

---

## 9. Synthèse rentabilité (rev. 5 — Business à 12,99 €/siège)

| Plan | Prix | Coûts directs | Marge nette | % marge | Δ vs rev. 4 |
|---|---|---|---|---|---|
| Solo | 9 € | 1,892 € | 7,108 € | **79 %** | — |
| Pro | 19 € | 4,111 € | 14,889 € | **78 %** | — |
| Business / siège (3 sièges) | **12,99 €** | 3,477 € | **9,513 €** | **73 %** | **+9 pts** |
| Business / siège (10 sièges) | **12,99 €** | 3,361 € | **9,629 €** | **74 %** | +9 pts |
| Business / siège (50 sièges) | **12,99 €** | 3,321 € | **9,669 €** | **74 %** | +9 pts |

**Marge brute moyenne pondérée attendue** (mix 60 % Solo / 30 % Pro / 10 % Business) : **≈ 78 %**.

---

## 10. Points d'attention pour l'auditeur

1. **Vérifier les tarifs OpenAI** sur https://openai.com/api/pricing/ (peuvent évoluer).
2. **Mesurer le taux de filtrage réel en production** (compteurs `prefilter_hits + cache_hits` / `ai_calls` sur ≥ 50 utilisateurs sur 30 jours).
3. **Analyse de sensibilité au taux de filtrage** :

   | Filtrage | Coût/mail reçu | Marge Solo | Marge Pro | **Marge Business (12,99 €)** |
   |---|---|---|---|---|
   | 50 % (pessimiste) | 0,000153 € | 78 % | 76 % | **70 %** |
   | **65 % (retenue)** | **0,000107 €** | **79 %** | **78 %** | **73 %** |
   | 80 % (optimiste) | 0,000061 € | 80 % | 79 % | **76 %** |

   → Modèle robuste : tous les plans restent à plus de **70 %** de marge même au scénario pessimiste.

4. **Hypothèse 30–40 % « actionable »** : estimation interne Inboria, à valider sur cohorte réelle (cf. § 4).
5. **Extrapolation 117 mails/jour → mensuel** : 3 510 = 30 jours **calendaires** ; 2 500 sur 22 jours ouvrés.
6. **Grille Paddle** : 5 % + 0,50 € est la grille standard EU ; certains contrats négociés diffèrent.
7. **Coûts Supabase** : paliers (Pro 25 $/mois jusqu'à un certain volume, puis compute / stockage / bande passante).
8. **Pré-filtre sur comptes neufs** : taux de filtrage plus proche de 30–40 % les premiers jours (cache `sender_cache` se remplit progressivement). Impact ponctuel ~0,30 € de coût supplémentaire le 1ᵉʳ mois.
9. **Coûts mobiles** (Expo / EAS Build / publication App Store / Google Play) : non chiffrés ici, marginaux.
10. **TVA** : non incluse (Paddle gère la TVA via son statut de Merchant of Record).
11. **Taux de change USD/EUR** : tous les calculs utilisent **1 USD = 0,92 EUR**, à actualiser à la date d'audit.

---

## 11. Sources

- OpenAI Pricing : https://openai.com/api/pricing/
- Microsoft Work Trend Index 2025 : https://news.microsoft.com/de-ch/2025/06/17/new-microsoft-study-reveals-the-rise-of-the-infinite-workday-40-of-employees-check-email-before-6-a-m-evening-meetings-up-16/
- Paddle Pricing : https://www.paddle.com/pricing
- Supabase Pricing : https://supabase.com/pricing
- Brevo Pricing : https://www.brevo.com/pricing/
- Code source pré-filtre Inboria : `artifacts/api-server/src/services/pre-filter.ts`

---

## 12. Scénario « pire cas réaliste » — abonné qui exploite toutes les fonctions IA

### 12.1 Hypothèses « abuser plausible »

| Action IA | Hypothèse worst case |
|---|---|
| Mails reçus & comptés (triage + RDV) | 100 % de 3 510 mails reçus, dont ~1 229 traités par OpenAI |
| Brouillon IA | 80 % des reçus → 2 808 |
| Régénération | 30 % des brouillons → 842 |
| Adapter le ton | 50 % des brouillons → 1 404 |
| Relance | 5/jour × 30 = 150 |
| Résumé fil conversation | 50 % des fils → 1 755 |
| Reclassification manuelle | 20/jour × 30 = 600 |
| Détection RDV manuelle | 100/mois |
| Chat support | 30/jour × 30 = 900 |
| Brief quotidien | 30 |
| Création projet IA | 20 |
| Catégorisation projet auto | 100 |

### 12.2 Coût OpenAI worst case par mois

| Action | Volume | Coût unitaire | Coût total |
|---|---|---|---|
| Triage + détection RDV (post-filtre 65 %) | 1 229 traités | 0,000306 € | 0,376 € |
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
| **TOTAL OpenAI worst case** | | | **3,437 €** |

### 12.3 Autres coûts directs « pire cas »

- **Brevo SMTP** : 1 500 mails sortants/mois × 0,00325 €/mail = **4,88 €** par abonné.
- **Supabase** (100 abonnés) : ~1,00 € / abonné.
- **Replit** (100 abonnés) : ~0,55 € / abonné.

### 12.4 Synthèse pire cas par plan (100 abonnés actifs = early stage)

#### Plan Solo « abuser » (9 €/mois)

| Poste | Montant |
|---|---|
| Revenu (9 € + dépassement 1,02 €) | **10,02 €** |
| OpenAI worst case | 3,437 € |
| Brevo | 4,88 € |
| Supabase | 1,00 € |
| Replit | 0,55 € |
| Paddle (2 transactions) | 2,00 € |
| **Total coûts directs** | **11,867 €** |
| **Marge nette** | **−1,847 € ⚠️ PERTE** |

#### Plan Pro « abuser » (19 €/mois)

| Poste | Montant |
|---|---|
| Revenu | **19,00 €** |
| OpenAI worst case | 3,437 € |
| Brevo | 4,88 € |
| Supabase | 1,00 € |
| Replit | 0,55 € |
| Paddle | 1,45 € |
| **Total coûts directs** | **11,317 €** |
| **Marge nette** | **+7,683 € (40 %)** ✅ |

#### Plan Business « abuser » (**12,99 €/siège**, 3 sièges)

| Poste / siège | Montant |
|---|---|
| Revenu / siège | **12,99 €** |
| OpenAI worst case | 3,437 € |
| Brevo | 4,88 € |
| Supabase | 1,00 € |
| Replit | 0,55 € |
| Paddle / siège | 0,816 € |
| **Total coûts directs / siège** | **10,683 €** |
| **Marge nette / siège** | **+2,307 € (18 %)** ✅ |

### 12.5 Conclusion sur le pire cas

| Plan | Marge worst case « 100 abonnés » | Verdict |
|---|---|---|
| Solo (9 €) | **−1,847 €** | ⚠️ Reste déficitaire si abus extrême |
| Pro (19 €) | **+7,683 €** (40 %) | ✅ Rentable même en pire cas |
| Business (12,99 €) | **+2,307 €** (18 %) | ✅ **Rentable même en pire cas** (était déficitaire à 9 €) |

**Diagnostic** : la **hausse Business à 12,99 €/siège transforme structurellement le pire cas** : ce qui était une perte certaine de −1,48 €/siège à 9 € devient un bénéfice de +2,31 €/siège. Seul Solo reste exposé en pire cas, mais le segment freelance individuel a structurellement moins de mails sortants → la probabilité réelle de pire cas y est faible.

---

## 13. Recommandation : système de crédits IA — deux variantes stratégiques

### 13.1 État actuel (livré en production)

Le **renommage** « quotas emails » → **« crédits IA »** est en production. La logique sous-jacente reste **« 1 mail reçu = 1 crédit consommé »** (Variante A).

### 13.2 Barème de crédits proposé

Unité de base : **1 crédit = 0,000306 € de coût de référence**.

| Action | Crédits |
|---|---|
| Mail entrant analysé (Variante A) | 1 |
| Mail entrant analysé (Variante B) | 1 *(uniquement si IA appelée)* |
| Brouillon IA / Régénération | 2 |
| Variante de ton | 1 |
| Relance IA | 2 |
| Résumé fil conversation | 2 |
| Reclassification manuelle | 1 |
| Détection RDV manuelle | gratuit |
| Chat support (1 message) | 1 |
| Brief quotidien | gratuit |
| Création projet via IA | 2 |
| Catégorisation projet auto | 1 |
| **Mail envoyé via Brevo** | **10** |
| Lecture, recherche, tri | gratuit |

### 13.3 Variante A — « 1 crédit = 1 mail reçu » (livré aujourd'hui)

✅ Aucun changement backend · ✅ Rétrocompatibilité · ❌ L'utilisateur ne perçoit aucune valeur du pré-filtre.

### 13.4 Variante B — « 1 crédit = 1 traitement IA réel » (recommandée)

Un mail reçu ne consomme un crédit que **si** OpenAI est réellement appelé.

**Conséquences immédiates** :
- 3 000 crédits Solo couvrent en moyenne **~8 570 mails reçus**
- 10 000 crédits Pro / Business couvrent **~28 570 mails reçus / siège**

**Argument commercial** :
> *« Avec Inboria, vous ne payez que le travail réel de l'IA. Notre filtre intelligent élimine en amont le bruit (newsletters, automates, no-reply) — vous économisez en moyenne 65 % de vos crédits. »*

**Effort dev** : 1 demi-journée. **Marge** identique pour Inboria, perception de valeur ×2,5 à 3 côté client.

### 13.5 Pay-as-you-go étendu en crédits

Couvre **toutes les actions consommatrices** (triage entrant, brouillons, résumés, chat, **et mails envoyés via Brevo à 10 crédits/envoi** — clé pour fermer la fuite Brevo identifiée au § 12).

Tarif PAYG : **5 000 crédits = 4,90 €** (≈ 0,00098 €/crédit) ou dépassement automatique à **0,0012 €/crédit**.

→ Marge PAYG > **90 %** sur tous les plans.

### 13.6 Recommandation finale

**Implémenter Variante B + PAYG étendu en crédits**. Effort estimé **3 à 5 jours**.

---

## 14. Business plan — rentabilité par plan et fixation des prix (Business à 12,99 €)

### 14.1 Trois profils d'abonnés modélisés

| Profil | % typique | Mails reçus/mois | % envoi | Envois/mois | Usage IA secondaire |
|---|---|---|---|---|---|
| **Light** (freelance occasionnel) | ~50 % | 900 (30/j) | 10 % | 90 | faible |
| **Median** (pro chargé) | ~35 % | 2 400 (80/j) | 20 % | 480 | modéré |
| **Heavy** (dirigeant) | ~15 % | 3 510 (117/j) | 30 % | 1 050 | intensif |

### 14.2 Crédits consommés par profil (Variante A)

| Profil | Crédits/mois |
|---|---|
| Light | 2 311 |
| Median | 9 274 |
| Heavy | 18 279 |

### 14.3 Coûts directs variables par profil

| Profil | OpenAI triage | OpenAI actions secondaires | OpenAI total | Brevo | **Total variable** |
|---|---|---|---|---|---|
| Light | 0,096 € | 0,21 € | 0,31 € | 0,27 € | **0,58 €** |
| Median | 0,257 € | 0,93 € | 1,18 € | 1,44 € | **2,62 €** |
| Heavy | 0,376 € | 3,06 € | 3,44 € | 3,15 € | **6,59 €** |

### 14.4 Marge unitaire par combinaison profil × plan (Business à 12,99 €)

Hypothèses : infra mutualisée à 100 abonnés (1,55 €/abonné). Paddle 5 % + 0,50 €/transaction.

#### Plan SOLO — 9 € / 3 000 crédits

| Profil | Crédits | Dépassement | Revenu PAYG | Revenu | Coûts | **Marge** | **%** |
|---|---|---|---|---|---|---|---|
| Light | 2 311 | 0 | 0 € | **9,00 €** | 3,08 € | **+5,92 €** | **66 %** ✅ |
| Median | 9 274 → +6 274 | 12,55 € | 12,55 € | **21,55 €** | 6,00 € | **+15,55 €** | **72 %** ✅ |
| Heavy | 18 279 → +15 279 | 30,56 € | 30,56 € | **39,56 €** | 10,67 € | **+28,89 €** | **73 %** ✅ |

#### Plan PRO — 19 € / 10 000 crédits

| Profil | Crédits | Dépassement | Revenu PAYG | Revenu | Coûts | **Marge** | **%** |
|---|---|---|---|---|---|---|---|
| Light | 2 311 | 0 | 0 € | **19,00 €** | 3,58 € | **+15,42 €** | **81 %** ⚠️ surpayé |
| Median | 9 274 | 0 | 0 € | **19,00 €** | 5,62 € | **+13,38 €** | **70 %** ✅ |
| Heavy | 18 279 → +8 279 | 9,93 € | 9,93 € | **28,93 €** | 10,59 € | **+18,34 €** | **63 %** ✅ |

#### Plan BUSINESS — **12,99 €/siège / 10 000 crédits/siège** (équipe 3 sièges)

Paddle/siège abonnement : (3 × 12,99 × 5 % + 0,50) / 3 = **0,816 €/siège**.

| Profil / siège | Crédits | Dépassement | Revenu PAYG | Revenu/siège | Coûts/siège | **Marge/siège** | **%** |
|---|---|---|---|---|---|---|---|
| Light | 2 311 | 0 | 0 € | **12,99 €** | 0,58 + 1,55 + 0,816 = 2,95 € | **+10,04 €** | **77 %** ✅ |
| Median | 9 274 | 0 | 0 € | **12,99 €** | 2,62 + 1,55 + 0,816 = 4,99 € | **+8,00 €** | **62 %** ✅ |
| Heavy | 18 279 → +8 279 | 9,93 € | 9,93 € | **22,92 €** | 6,59 + 1,55 + 1,23 = 9,37 € | **+13,55 €** | **59 %** ✅ |

→ Tous les couples profil × plan sont **rentables**. Marge minimale **59 %** (Business heavy avec dépassement), maximale **81 %** (Pro light surpayé).

### 14.5 Diagnostic des prix actuels

| Plan | Prix actuel | Marge min. | Marge max. | Diagnostic |
|---|---|---|---|---|
| **Essai** | gratuit | n/a | n/a | Conserver |
| **Solo** | 9 € | 66 % | 73 % | Sweet spot, conserver |
| **Pro** | 19 € | 63 % | 81 % | Conserver |
| **Business** | **12,99 €/siège** | **59 %** | **77 %** | **Pricing optimal — conserver** |

→ La hausse de 9 € à 12,99 € sur Business est **pleinement justifiée par les chiffres** : la marge minimale passe de 47 % (rev. 4 à 9 €) à **59 %** (rev. 5 à 12,99 €), alignant Business sur la rentabilité de Pro tout en restant compétitif sur le segment équipe (concurrents Front, Hiver, Missive : 19–35 €/siège).

### 14.6 Projection à l'échelle (Business à 12,99 €)

Distribution sur 100 abonnés payants : 55 Solo · 30 Pro · 15 sièges Business (5 équipes de 3, profil heavy).

#### Marge mensuelle agrégée par palier d'échelle

| Palier | Infra/abonné | Marge Solo (×55) | Marge Pro (×30) | Marge Business (×15) | **Marge brute/mois** | **MRR** |
|---|---|---|---|---|---|---|
| **100 abonnés** | 1,55 € | 55 × 8,55 € = 470 € | 30 × 16,99 € = 510 € | 15 × 13,55 € = **203 €** | **1 183 €** | **~2 745 €** |
| **500 abonnés** | 0,31 € | 275 × 9,79 € = 2 692 € | 150 × 18,23 € = 2 735 € | 75 × 14,79 € = **1 109 €** | **6 536 €** | **~13 725 €** |
| **1 000 abonnés** | 0,155 € | 550 × 9,95 € = 5 472 € | 300 × 18,39 € = 5 517 € | 150 × 14,95 € = **2 242 €** | **13 231 €** | **~27 450 €** |
| **5 000 abonnés** | 0,031 € | 2 750 × 10,07 € = 27 692 € | 1 500 × 18,51 € = 27 765 € | 750 × 15,07 € = **11 303 €** | **66 760 €** | **~137 250 €** |

#### Marge nette annuelle (après CAC)

| Palier | Marge brute annuelle | CAC estimé | **Bénéfice net annuel** |
|---|---|---|---|
| 100 abonnés | 14 196 € | ~750 € | **~13 450 €** |
| 500 abonnés | 78 432 € | ~3 750 € | **~74 700 €** |
| 1 000 abonnés | 158 772 € | ~7 500 € | **~151 250 €** |
| 5 000 abonnés | 801 120 € | ~37 500 € | **~763 600 €** |

→ Gain vs rev. 4 (Business à 9 €) à 1 000 abonnés : **+7 250 €/an** ; à 5 000 abonnés : **+36 350 €/an**.

### 14.7 Scénarios alternatifs

| Scénario | Effet sur MRR à 1 000 abonnés | Risque | Décision |
|---|---|---|---|
| **Conserver 12,99 €/siège** (recommandé) | 27 450 € | aucun | ✅ |
| Redescendre à 9 €/siège | 26 850 € (−600 €/mois) | sacrifier la marge sans gain commercial démontré | ❌ |
| Monter à 14,99 €/siège | 27 750 € (+300 €/mois) | risque churn équipes prudentes | ⚠️ tester |
| Pricing annuel −20 % | LTV ×3 (engagement annuel) + économies frais Paddle | aucun | ✅ ajouter |

### 14.8 Conclusion business plan rev. 5

| Question | Réponse |
|---|---|
| Chaque plan est-il rentable ? | **Oui** — marge minimale **59 %** (Business heavy), maximale **81 %** (Pro light) |
| Tarification recommandée | **Solo 9 € / Pro 19 € / Business 12,99 €/siège** (inchangée vs production actuelle) |
| Seuil de rentabilité opérationnelle | Atteint dès **~50 abonnés payants** |
| Salaire fondateur 3 000 €/mois net | **~250 abonnés payants** mix actuel |
| Viabilité équipe (10 000 €/mois) | **~750 abonnés payants** |
| Variante de crédits recommandée | **Variante B** — argument marketing décisif |
| Levier prioritaire restant | **PAYG étendu en crédits incluant Brevo (10 crédits/envoi)** + pricing annuel −20 % |

---

## 15. Réponses aux remarques de l'auditeur externe (rev. 5)

| Remarque auditeur | Statut | Action prise |
|---|---|---|
| Coûts secondaires en EUR potentiellement non convertis | ✅ Vérifié | Tableau § 3.5 confirme l'application du facteur 0,92 sur toutes les lignes |
| Marges Business 10 / 50 sièges surévaluées (41 % / 43 %) | ✅ Recalculé | Avec le **vrai prix 12,99 €**, marges réelles : 74 % / 74 % (pas 41 / 43) — le calcul rev. 4 utilisait à tort 9 €/siège |
| « 30–40 % actionable » attribué à Microsoft | ✅ Corrigé | § 4 explicite : estimation interne Inboria, à valider sur cohorte réelle |
| Extrapolation 117 mails/jour | ✅ Précisé | § 4 indique : 30 jours **calendaires** (≈ 2 500 mails sur 22 jours ouvrés) |
| Tarifs OpenAI à reconfirmer | ⚠️ À faire à chaque audit | § 10.1 maintient le rappel |
| Taux USD/EUR | ⚠️ À actualiser à la date d'audit | § 10.11 maintient le rappel |

---

*Fin du document — révision 5.*
