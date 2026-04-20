# Vérification de la révision 5 du document Inboria

Mon verdict est le suivant : **la révision 5 est globalement solide sur le cœur du raisonnement**, et le repositionnement du plan Business à **12,99 € / siège** est **arithmétiquement cohérent** dans les sections de marge standard et de pire cas. En revanche, **le document n’est pas totalement exact** : il reste plusieurs **erreurs de formulation ou de projection**, surtout dans la partie **business plan / projection à l’échelle**, ainsi qu’une affirmation concurrentielle un peu trop approximative.

## Verdict synthétique

| Point contrôlé | Verdict | Commentaire |
|---|---:|---|
| Prix Business à 12,99 € / siège | Correct | Le changement de prix est bien propagé dans les tableaux principaux. |
| Marges standard Solo / Pro / Business (§7) | Correctes à l’arrondi | Les résultats recalculés retombent très près des montants affichés. |
| Pire cas Business à 12,99 € (§12.4) | Correct | Le plan Business redevient bien rentable dans le pire cas. |
| Sens économique du repositionnement Business | Correct | Le prix de 12,99 € améliore clairement la cohérence face au Pro. |
| Phrase « Business devient le plan le plus rentable » | Faux | En absolu, le Pro garde une marge par utilisateur plus élevée ; en %, Business reste aussi sous Solo et Pro. |
| Projection MRR / marge à l’échelle (§14.6) | Faux / incohérent | Les chiffres agrégés ne correspondent pas aux profils et revenus indiqués dans les tableaux précédents. |
| Référence concurrentielle « Front, Hiver, Missive : 19–35 €/siège » | Approximative à fausse | Les prix officiels observés sont plus dispersés que cette fourchette. |
| Référence technique au fichier `pre-filter.ts` | Non vérifiée ici | Le fichier n’a pas été retrouvé dans le sandbox où j’ai contrôlé le document. |

## Ce qui est exact

Les sections de coût unitaire et de marges standard tiennent correctement. En recalculant avec les hypothèses du document, on retrouve notamment :

| Élément | Valeur document | Valeur recalculée |
|---|---:|---:|
| Sous-total OpenAI Solo | 0,792 € | 0,79065 € |
| Sous-total OpenAI Pro | 2,511 € | 2,50985 € |
| Paddle Business 3 sièges | 0,816 € | 0,81617 € |
| Marge Business 3 sièges | 9,513 € | 9,514 € |
| OpenAI worst case (§12.2) | 3,437 € | 3,4358 € |
| Marge Business worst case (§12.4) | 2,307 € | 2,308 € |

Ces écarts sont faibles et relèvent de l’**arrondi**, pas d’une erreur de raisonnement. Sur ce point, la thèse centrale du document tient : **à 12,99 € / siège, le plan Business devient bien beaucoup plus crédible et plus robuste** qu’à 9 €.

## Ce qui n’est pas exact

### 1. La phrase de conclusion de la section 7.3 est fausse

Le document affirme :

> « À 12,99 €/siège, Business devient le plan le plus rentable d'Inboria en marge nette par utilisateur, devançant Solo (7,11 €) et Pro (14,89 € en absolu, 78 % en %). »

Cette phrase est contradictoire avec ses propres chiffres. En effet :

| Plan | Marge nette / utilisateur | % marge |
|---|---:|---:|
| Solo | 7,108 € | 79 % |
| Pro | 14,889 € | 78 % |
| Business | 9,513 € | 73 % |

Donc **Business ne “devance” pas Pro en marge absolue**, ni Solo/Pro en pourcentage. La bonne formulation serait plutôt :

> **« À 12,99 €/siège, Business devient nettement plus cohérent et suffisamment rentable, sans toutefois dépasser Pro en marge absolue ni Solo/Pro en pourcentage. »**

### 2. La section 14.6 est incohérente

C’est le principal problème restant du document.

Le tableau de projection à l’échelle annonce par exemple, pour **100 abonnés**, un **MRR d’environ 2 745 €** et une **marge brute mensuelle de 1 183 €**. Or ces montants ne retombent pas correctement quand on utilise les volumes et les profils explicitement décrits juste au-dessus.

À partir du mix déclaré dans la section 14.6 :

- **55 Solo** = 40 light + 15 median,
- **30 Pro** = 20 median + 10 heavy,
- **15 sièges Business** = 15 heavy,

on obtient plutôt les ordres de grandeur suivants :

| Indicateur | Valeur document | Valeur recalculée |
|---|---:|---:|
| MRR 100 abonnés | ~2 745 € | ~1 696 € si on reprend les revenus affichés par profil |
| Marge brute mensuelle 100 abonnés | 1 183 € | ~1 124 € si on agrège les marges profil par profil |
| Marge moyenne Pro implicite | 16,99 € | ~15,03 € selon les lignes du §14.4 |

Autrement dit, **la logique locale des tableaux profil × plan tient**, mais **l’agrégation de la section 14.6 ne suit pas correctement ces propres hypothèses**.

### 3. La borne concurrentielle est trop simplifiée

Le document écrit que Business à 12,99 € reste compétitif car des concurrents comme **Front, Hiver, Missive** seraient autour de **19–35 €/siège**. Cette phrase est **trop large et pas strictement exacte**.

En vérifiant des sources officielles accessibles au moment du contrôle :

| Outil | Prix officiel observé |
|---|---:|
| Front | Starter **25 $**, Professional **65 $**, Enterprise **105 $** par siège/mois sur la page officielle [1] |
| Missive | Starter **14 $**, Productive **24 $**, Business **36 $** par utilisateur/mois sur la page officielle [2] |
| Hiver | Les résultats trouvés pointent plutôt vers un démarrage autour de **25 $** sur la page officielle de pricing [3] |

La bonne formulation serait donc plutôt :

> **« Le prix de 12,99 € / siège reste compétitif face à plusieurs outils d’email collaboratif ou shared inbox, dont les offres payantes démarrent souvent entre le milieu de la dizaine et plusieurs dizaines d’euros/dollars par siège selon le niveau de service. »**

### 4. La référence technique au pré-filtre n’a pas été confirmée dans cet environnement

Le document cite le fichier `artifacts/api-server/src/services/pre-filter.ts`, mais je n’ai pas retrouvé de fichier `pre-filter.ts` dans le sandbox utilisé pour cette vérification. Cela **ne prouve pas que l’affirmation est fausse**, mais cela veut dire que **je ne peux pas valider ici la référence code**.

## Conclusion pratique

En résumé, ma réponse à **« Est-ce exact ? »** est :

> **Presque, mais pas totalement.**

Le document est **correct sur l’essentiel** :

- le passage de **9 € à 12,99 € / siège** pour Business est **bien justifié** ;
- les **marges standard** et le **pire cas Business** sont **globalement exacts** ;
- la logique produit/pricing devient plus crédible.

En revanche, je corrigerais **avant diffusion finale** :

| Priorité | Correction à faire |
|---|---|
| Haute | Corriger la phrase erronée de la section 7.3 sur le « plan le plus rentable » |
| Haute | Refaire entièrement la section 14.6 (MRR, marge mensuelle, bénéfice annuel) à partir des profils du §14.4 |
| Moyenne | Assouplir ou sourcer plus proprement la comparaison concurrentielle Front / Hiver / Missive |
| Moyenne | Si possible, annexer une preuve du pré-filtre de production ou une export métrique, plutôt qu’une simple référence de chemin de fichier |

Après ces corrections, la révision 5 deviendrait **beaucoup plus propre pour un audit externe**.

## Références

[1]: https://front.com/pricing "Front Pricing and Plans | Front"
[2]: https://missiveapp.com/pricing "Pricing · Missive"
[3]: https://hiverhq.com/pricing "Hiver Pricing | Get started with Hiver for free today! Explore plans"
[4]: file:///home/ubuntu/rev5_check.py "Recalcul interne de contrôle de la révision 5"
[5]: file:///home/ubuntu/rev5_projection_check.py "Contrôle des projections agrégées de la révision 5"
