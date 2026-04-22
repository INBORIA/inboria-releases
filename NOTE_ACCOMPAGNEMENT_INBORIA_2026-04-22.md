# Note d'accompagnement et synthèse détaillée — Inboria

**À lire avant le rapport d'audit complet**

| | |
|---|---|
| **Émetteur** | Jean-Jacques Neybergh, fondateur d'Inboria |
| **Destinataire** | Lecteur tiers du rapport d'audit (comptable, conseiller, partenaire) |
| **Date** | 22 avril 2026 |
| **Document de référence** | `RAPPORT_AUDIT_INBORIA_2026-04-22.md` (et `.html`) |
| **Version** | 1.0 |

---

## Partie 1 — Note d'accompagnement

### Pourquoi ce document existe

Le rapport d'audit ci-joint a été produit pour répondre à une question simple : **est-ce que le modèle économique d'Inboria tient la route, et est-ce que la facturation IA des clients est fiable ?**

Il a été rédigé pour un usage avant tout interne — suivre la rentabilité, valider les hypothèses de coûts, et garder une trace datée des marges par plan tarifaire. Il est néanmoins suffisamment sourcé et transparent pour être lu par un tiers de confiance (comptable, conseiller, partenaire commercial éventuel) sans modification.

### Ce qu'est Inboria, en quelques lignes

Inboria est un service en ligne pour PME (petites et moyennes entreprises) qui automatise le traitement de la boîte mail professionnelle grâce à l'intelligence artificielle : tri automatique, brouillons de réponse, résumés quotidiens, détection de rendez-vous, recherche conversationnelle. Le service fonctionne en abonnement mensuel par utilisateur ou par siège.

- **Domaine commercial** : inboria.com
- **Phase actuelle** : bêta privée fermée (aucun client payant à ce jour)
- **Stack technique** : application web React, application mobile Expo, base de données Supabase, paiements via Paddle (gelés pendant la bêta), modèle IA OpenAI `gpt-4o-mini`
- **Plans tarifaires** :
  - **Solo** : 9 €/mois — 3 000 e-mails traités
  - **Pro** : 19 €/mois — 10 000 e-mails traités
  - **Business** : 12,99 €/mois et par siège (3 sièges minimum) — 10 000 e-mails traités

### Comment lire le rapport

Le rapport principal est organisé en cinq sections :

1. **Synthèse exécutive** — les conclusions clés en une page
2. **Audit du système de facturation IA** — comment Inboria compte ce qui est consommé chez OpenAI et le refacture aux clients sans perte ni double comptage
3. **Audit de rentabilité** — coûts fixes mensuels, marges nettes par plan, seuils de rentabilité
4. **Recommandations** — actions à mener pour sécuriser et développer le service
5. **Annexes** — sources officielles citées (A), paliers d'infrastructure (B), pièces justificatives dans le code source (C)

Le rapport contient également un historique des versions en fin de document, qui trace toutes les corrections apportées suite à un contrôle externe des sources.

### Points d'attention pour le lecteur

Trois points méritent d'être compris avant la lecture :

1. **Phase de projet** : le rapport raisonne sur une **phase de démarrage commercial**, pas sur une cible d'hypercroissance. Les coûts fixes sont dimensionnés pour les **premiers mois de commercialisation**, pas pour 100 000 utilisateurs.

2. **Niveau de preuve différencié** : dans le tableau des coûts fixes (section 3.2 du rapport), une colonne « Niveau de preuve » indique pour chaque ligne si le coût est **confirmé** par une source officielle ou s'il s'agit d'une **estimation interne** à valider par facture réelle dès la production en place. Les deux postes encore estimatifs sont **Replit Reserved VM** et **Brevo** (le fournisseur d'envoi d'e-mails transactionnels).

3. **Bêta privée fermée** : à la date de rédaction, **aucun encaissement client n'a eu lieu**. Les paiements et les inscriptions publiques sont volontairement désactivés via un commutateur logiciel (`VITE_PAYMENTS_ENABLED`). Toutes les projections sont donc des projections, pas des résultats observés.

### Ce que le rapport ne couvre pas

Pour éviter toute lecture erronée, voici ce que le rapport **ne fait pas** :

- Il ne contient **aucune projection commerciale** (nombre de clients prévus dans 12 ou 24 mois, parts de marché visées). Il décrit uniquement la **structure** économique du produit.
- Il **ne valorise pas l'entreprise** et n'a pas vocation à servir de support de levée de fonds.
- Il ne traite pas les questions juridiques, fiscales ou de conformité (RGPD, CGV, mentions légales).
- Il ne traite pas les questions de propriété intellectuelle ni la protection de la marque.

Pour ces sujets, un conseil spécialisé est nécessaire.

---

## Partie 2 — Synthèse détaillée du rapport

Cette synthèse reprend les conclusions principales du rapport d'audit. Elle ne remplace pas la lecture du document complet, qui contient les sources, les calculs détaillés et les pièces justificatives en annexe.

### 2.1 Système de facturation IA — verdict

**Verdict : système solide, fiable, conçu pour ne jamais facturer un client pour un service qu'il n'a pas reçu.**

#### Comment ça marche, en français simple

Quand un client utilise une fonction d'intelligence artificielle (tri d'un e-mail, génération d'un brouillon de réponse, résumé quotidien, etc.), le système :

1. Vérifie que le client a encore du quota disponible **avant** d'appeler OpenAI
2. Si le quota est épuisé, refuse l'opération immédiatement (« fail-closed »)
3. Si le quota est suffisant, appelle OpenAI et réserve le coût correspondant
4. Enregistre **immédiatement** la consommation dans une table dédiée appelée `usage_events` (« événements de consommation »)
5. Recalcule le compteur de quota du client à partir de cette table, qui sert de **source de vérité**

Chaque type d'opération a un coût en « crédits internes » fixé à l'avance dans le code, par exemple :
- Génération d'un brouillon de réponse : 2 crédits
- Résumé quotidien d'une boîte : 3 crédits
- Détection automatique de rendez-vous : 3 crédits
- Une réponse du chat support : 1 crédit

Cette grille de coûts se trouve dans le fichier `artifacts/api-server/src/services/credits.ts`, et elle est directement vérifiable par lecture du code.

#### Sécurités en place

- **Bouton « Recompte » dans l'interface d'administration** — permet de recalculer le compteur d'un client à partir des événements bruts en cas de doute
- **Triage forfaitaire** — la fonction de tri d'e-mails utilise un coût forfaitaire (`emails_used`) plutôt que de facturer chaque appel OpenAI individuellement, ce qui élimine une catégorie entière de risque de comptage
- **Source de vérité unique** — la table `usage_events` est la référence ; les autres compteurs sont reconstruits à partir d'elle
- **Refus en cas de panne** — si un appel OpenAI échoue ou plante, le crédit n'est pas consommé

#### Risque résiduel chiffré

Le seul scénario théorique où Inboria pourrait être facturé par OpenAI sans facturer son client est le suivant : **panne du serveur Express précisément entre la réponse d'OpenAI et l'écriture dans la base de données**. Ce scénario est extrêmement improbable et représente un risque financier estimé à **moins de 1 € par an**, ce qui est négligeable.

### 2.2 Rentabilité par plan — verdict

**Verdict : marges nettes très confortables sur les trois plans, même dans l'hypothèse pessimiste.**

#### Hypothèse de calcul retenue

Pour rester prudent, la marge a été calculée dans le **scénario le moins favorable** : chaque client consomme **100 % de son quota mensuel** (consommation maximale d'OpenAI). En pratique, la consommation moyenne sera nettement inférieure et les marges réelles seront donc **plus élevées** que celles présentées ici.

#### Marges nettes par plan (cas pire)

| Plan | Prix client | Coût IA pire cas | Frais Paddle | Marge nette | Marge en % |
|---|---:|---:|---:|---:|---:|
| **Solo** | 9 € | 0,68 € | 0,95 € | 7,37 € | **81 %** |
| **Pro** | 19 € | 2,28 € | 1,45 € | 15,27 € | **79 %** |
| **Business** | 12,99 €/siège (×3 mini = 38,97 €) | 6,84 € | 2,45 € | 29,68 € | **74 %** |

Toutes les marges sont à plus de **70 %** dans le scénario le plus défavorable. C'est une assise économique très saine pour un produit en phase de lancement.

#### Coûts fixes mensuels

| Phase | Total mensuel | Détail |
|---|---:|---|
| **Bêta actuelle** (aucun client) | ~28 € | Replit Core 18 € + Reserved VM ~9 € + Domaine 1 € (Supabase et Brevo en gratuit) |
| **Lancement** (1 à 100 abonnés) | ~83 € | Ajout de Supabase Pro 23 € et Brevo Business ~17 € |
| **Croissance** (100 à 2 000 abonnés) | ~104 € | Replit Reserved VM dimensionnée plus large + Brevo palier supérieur |

Deux lignes du tableau (Replit Reserved VM et Brevo) sont marquées comme **estimations internes** dans le rapport, à confirmer par facture réelle dès la production en place.

#### Seuil de rentabilité (pire cas, 100 % Business)

Combien de clients faut-il pour couvrir les coûts fixes, dans l'hypothèse la plus défavorable où tous les clients sont en plan Business avec consommation maximale ?

| Phase | Coûts fixes | Clients Business nécessaires |
|---|---:|---:|
| Bêta | 28 € | **1 client** |
| Lancement | 83 € | **3 clients** |
| Croissance | 104 € | **4 clients** |

À titre d'illustration, **100 clients Business** dans le scénario le plus défavorable génèreraient un bénéfice net annuel d'environ **33 000 €**. Dans une hypothèse de consommation moyenne plus réaliste (50 % du quota), ce chiffre serait sensiblement plus élevé.

### 2.3 Sources et niveau de preuve

Le rapport cite cinq sources officielles, toutes accessibles publiquement :

| # | Source | Coût | Niveau de preuve |
|---|---|---|---|
| [1] | OpenAI | 0,15 $/1M tokens entrée, 0,60 $/1M tokens sortie pour `gpt-4o-mini` | **Confirmé** |
| [2] | Paddle | 5 % + 0,50 $ par transaction | **Confirmé** |
| [3] | Supabase | Pro à partir de 25 $/mois | **Confirmé** |
| [4] | Replit | Core à 20 $/mois | **Confirmé** ; Reserved VM **estimée** |
| [5] | Brevo | Free 300 mails/jour | **Confirmé** ; paliers payants **estimés** |

Les deux estimations restantes seront remplacées par les factures réelles dès le premier mois de production commerciale.

### 2.4 Recommandations principales du rapport

Le rapport identifie plusieurs chantiers à mener avant ou pendant l'ouverture commerciale :

1. **Tester de bout en bout l'encaissement Paddle** en mode production avant la levée du gel des paiements
2. **Configurer les magic links Supabase et l'OAuth Gmail** sur le domaine inboria.com en production
3. **Activer les alertes opérationnelles** (boîte e-mail déconnectée, plantage de la connexion IMAP)
4. **Mettre en place la limitation de débit** sur les actions IA pour prévenir les abus
5. **Remplacer les estimations Replit Reserved VM et Brevo par les factures réelles** dès le premier mois de production

Ces points sont déjà inscrits dans le suivi interne du projet.

### 2.5 Conclusion

Le modèle économique d'Inboria, tel que documenté dans le rapport d'audit du 22 avril 2026, présente :

- **Une intégrité de facturation IA solide** (risque résiduel inférieur à 1 € par an)
- **Des marges nettes confortables** (74 % à 81 % dans le scénario le plus défavorable)
- **Des coûts fixes maîtrisés** (28 € en bêta, 83 € en lancement, 104 € en croissance)
- **Un seuil de rentabilité bas** (1 à 4 clients Business selon la phase)
- **Une transparence méthodologique** sur les estimations restantes (Replit VM, Brevo)

Le projet est en mesure d'aborder l'ouverture commerciale dans des conditions économiques saines, sous réserve de mener à bien les chantiers techniques identifiés dans la section recommandations du rapport.

---

**Fin de la note d'accompagnement.**

Pour les détails complets, les calculs intermédiaires et les références aux pièces justificatives dans le code source, se reporter au document `RAPPORT_AUDIT_INBORIA_2026-04-22.md` (ou sa version imprimable `.html`).
