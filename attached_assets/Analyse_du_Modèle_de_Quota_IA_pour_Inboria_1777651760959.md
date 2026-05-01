# Analyse du Modèle de Quota IA pour Inboria

Ce rapport examine les différents modèles de gestion des quotas de crédits IA pour Inboria, un SaaS B2B d'automatisation des e-mails. L'objectif est de formuler une recommandation stratégique qui équilibre la prévisibilité des coûts pour l'éditeur et la satisfaction des clients, tout en s'alignant sur les pratiques actuelles du marché.

## Pratiques Concurrentes et Benchmarks SaaS IA B2B

L'analyse des pratiques des acteurs majeurs du SaaS B2B et des outils d'IA générative révèle une tendance nette quant à la gestion des quotas mensuels inclus dans les abonnements.

La très grande majorité des éditeurs applique un **reset mensuel strict** (Scénario A) pour les crédits alloués dans le cadre d'un abonnement régulier [1] [2]. Des entreprises comme Notion (pour ses Custom Agents), HubSpot (avec Breeze), Figma (plan Professional), Otter.ai et Simplified réinitialisent systématiquement les compteurs à chaque cycle de facturation [3] [4] [5] [6]. Cette approche garantit une marge brute prévisible et protège l'éditeur contre les pics de consommation différés.

Une distinction importante est observée concernant les **achats ponctuels** (top-ups). Lorsque les utilisateurs acquièrent des crédits supplémentaires en dehors de leur allocation mensuelle, ces crédits bénéficient souvent d'une politique de report (rollover) s'étendant de plusieurs mois à un an, voire sans expiration [7]. Descript illustre cette pratique : les crédits inclus dans l'abonnement expirent à la fin du mois, tandis que les recharges payantes restent valables pendant 12 mois [8].

Concernant les concurrents directs d'Inboria dans le domaine de l'e-mail IA, Shortwave applique un quota journalier glissant sans mécanisme de report visible [9]. Superhuman, quant à lui, intègre ses fonctionnalités IA dans son plan Business sans mention explicite d'un système de crédits plafonnés, optant pour une tarification premium couvrant l'usage [10].

## Recommandation Stratégique : Le Scénario C (Rollover Plafonné)

Bien que le reset mensuel strict soit la norme dominante, l'adoption d'un **report (rollover) plafonné** (Scénario C) représente un avantage concurrentiel significatif pour Inboria, particulièrement sur le segment des PME francophones. Ce modèle répond efficacement aux objections de "paiement pour du vide" tout en limitant l'exposition financière de l'entreprise.

### Analyse des Coûts et Justification

Les données techniques indiquent un coût unitaire très faible pour les requêtes via `gpt-4o-mini` (environ 0,0003 € à 0,0008 € par crédit). Pour un abonnement Pro facturé 19 € par mois offrant 10 000 crédits, le coût maximal théorique d'exécution se situe entre 3 € et 8 €. La marge brute reste donc largement positive, même en cas de consommation totale.

Le risque majeur du Scénario B (cumulatif sans limite) réside dans l'accumulation dormante suivie d'une liquidation massive. Un client inactif pendant 11 mois pourrait accumuler 110 000 crédits, puis consommer 120 000 crédits le 12ème mois. Ce mois de liquidation engendrerait un coût d'infrastructure d'environ 96 €, dépassant largement les 19 € de revenus mensuels, créant ainsi une marge négative ponctuelle susceptible de perturber la trésorerie.

Le Scénario C atténue ce risque tout en valorisant la flexibilité. Un plafond fixé à **1 mois de report** (soit un cumul maximal équivalent à deux mois de quota) est optimal. Pour le plan Pro, le solde maximal atteindrait 20 000 crédits. En cas de liquidation totale, le coût maximal s'élèverait à environ 16 €, préservant une marge brute positive face au revenu de 19 €. Ce plafond absorbe les variations d'activité saisonnières (comme les périodes de congés estivaux ou les baisses d'activité en fin d'année) fréquentes chez les PME.

### Réponses aux Questions Ouvertes

**Quel scénario recommandez-vous pour un SaaS IA B2B ciblant les PME francophones ?**
Le Scénario C (rollover plafonné) est recommandé. Il transforme une contrainte technique en un argument commercial de souplesse, particulièrement apprécié par les PME qui ont souvent une charge de travail fluctuante. Il différencie Inboria des géants du secteur qui imposent des règles strictes.

**Quel plafond raisonnable pour le rollover ?**
Un plafond de **1 mois bonus** (soit 200% du quota mensuel standard) est le plus pertinent. Il couvre la grande majorité des cas d'usage légitimes liés aux congés ou aux baisses temporaires d'activité, tout en plafonnant le risque financier à un niveau garantissant la rentabilité mensuelle.

**Faut-il afficher la valeur "lifetime" (total consommé) en complément ?**
L'affichage de la consommation "lifetime" n'est pas recommandé par défaut sur le tableau de bord principal, car il n'apporte pas de valeur opérationnelle directe et peut induire une confusion avec le solde disponible. Il est préférable de mettre en avant les métriques de valeur générée (par exemple, "heures gagnées ce mois-ci grâce à l'IA" ou "e-mails traités automatiquement").

**Faut-il proposer un mécanisme de "carry-over" payant ?**
Non, la mise en place d'un mécanisme de conversion des crédits non consommés en bons d'achat introduit une complexité comptable et technique disproportionnée par rapport à la valeur perçue. L'abonnement donne accès à une capacité de traitement, il ne s'agit pas d'un compte épargne.

**La communication "non reportés" doit-elle figurer sur la page tarifs ?**
Si Inboria adopte le Scénario C, la communication doit être positive : "Crédits reportables jusqu'à 2 mois". Si le Scénario A était finalement retenu, la mention "renouvellement mensuel" est suffisante et standard dans l'industrie ; il est inutile d'utiliser une formulation négative comme "non reportés" qui pourrait créer une friction commerciale inutile.

## Implémentation Technique

L'architecture actuelle (React, Supabase, Express) permet une transition aisée vers le Scénario C. La modification de la fonction `ensureCurrentPeriod` pour inclure le calcul du report (avec écrêtage au plafond défini) lors du cron mensuel est une évolution mineure de la table `usage_events`.

## Références

[1] "We've built AI Credits. And it was harder than we expected.", Stigg Blog, https://www.stigg.io/blog-posts/weve-built-ai-credits-and-it-was-harder-than-we-expected
[2] "Buy & track Notion credits for Custom Agents", Notion Help Center, https://www.notion.com/help/custom-agent-pricing
[3] "Understand HubSpot Credits and billing", HubSpot Knowledge Base, https://knowledge.hubspot.com/account-management/understand-hubspot-credits-and-billing
[4] "Can Unused Monthly AI Credits Carry Forward?", Figma Community Forum, https://forum.figma.com/suggest-a-feature-11/can-unused-monthly-ai-credits-carry-forward-suggestion-for-credit-rollover-feature-52368
[5] "Pricing", Otter.ai, https://otter.ai/pricing
[6] "Do unused AI credits roll over to the next month?", Simplified Help Center, https://help.simplified.com/en/articles/5879208-do-unused-ai-credits-roll-over-to-the-next-month
[7] "Dear Runway, please rollover credits.", Reddit r/runwayml, https://www.reddit.com/r/runwayml/comments/1ohlws2/dear_runway_please_rollover_credits_please_an/
[8] "Descript pricing overhaul", Cotovan Blog, https://cotovan.com/post/descript-pricing-media-minutes-ai-credits-topups/
[9] "Pricing", Shortwave, https://www.shortwave.com/pricing/
[10] "Superhuman Suite | Pricing & Plans", Superhuman, https://superhuman.com/plans
