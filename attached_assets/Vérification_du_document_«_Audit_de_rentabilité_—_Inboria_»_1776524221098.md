# Vérification du document « Audit de rentabilité — Inboria »

J’ai vérifié le document joint sur trois plans distincts : les **sources externes**, les **prix publics consultables**, et les **calculs arithmétiques internes**. La conclusion générale est la suivante : le document est **globalement crédible dans son raisonnement économique**, mais il n’est **pas entièrement exact** dans le détail. Certaines hypothèses sont bien fondées, plusieurs ordres de grandeur sont corrects, mais quelques chiffres sont **approximatifs**, certains postes sont **mal convertis de dollars vers euros**, et une partie des marges Business est **surévaluée**.[1] [2] [3] [4]

## Verdict synthétique

| Élément vérifié | Verdict | Commentaire |
|---|---:|---|
| 117 emails/jour pour un employé moyen | Exact | C’est bien cohérent avec le rapport Microsoft Work Trend Index Special Report consulté.[1] |
| Paddle à 5% + 50¢ | Exact en ordre de grandeur | La page Paddle affiche bien **5% + 50¢ per Checkout transaction**.[2] |
| Supabase à ~25 $/mois | Exact en ordre de grandeur | La page Supabase affiche bien un plan Pro **à partir de 25 $/mois**.[3] |
| Coût de triage par mail à ~0,00031 € | Correct | Le calcul détaillé donne **0,000333 $**, soit **0,00030636 €** avec le taux de conversion retenu.[4] |
| Coûts unitaires des actions IA secondaires en euros | Inexact | Plusieurs valeurs semblent reprises en dollars puis étiquetées en euros, sans conversion cohérente.[4] |
| Marge Solo à 71% | Presque exacte | Avec les hypothèses du document, on obtient plutôt **6,41 € de marge**, soit environ **71,2%**, donc l’ordre de grandeur est bon.[4] |
| Marge Pro à 66% | Presque exacte | Le recalcul donne environ **12,56 € de marge**, soit **66,1%**.[4] |
| Marge Business à 3 sièges de 38% | Correcte | Le recalcul donne environ **37,7%**, ce qui arrondit bien à **38%**.[4] |
| Marge Business à 10 sièges de 41% | Incorrecte | Le recalcul donne environ **39,1%** et non 41%.[4] |
| Marge Business à 50 sièges de 43% | Incorrecte | Le recalcul donne environ **39,6%** et non 43%.[4] |
| Hypothèse « 30–40% de mails actionnables » attribuée à Microsoft | Non démontrée | Le rapport Microsoft vérifié donne le volume d’emails, mais pas ce pourcentage précis.[1] |

## Ce qui est exact ou solide

Le document est **solide** sur plusieurs bases structurelles. La statistique centrale de marché, à savoir **117 emails reçus par jour** par l’employé moyen, est bien présente dans la source Microsoft consultée. Cette source précise en outre que l’employé moyen reçoit aussi **153 messages Teams par jour**, ce qui renforce l’idée générale d’une surcharge informationnelle.[1]

La partie sur **Paddle** est également bien ancrée dans une source publique actuelle. La page de tarification consultée affiche une offre standard à **5% + 50¢ par transaction Checkout**. Le document a donc raison sur le mécanisme de commission standard, même si la page publique l’exprime en cents et non en euros ; le montant exact en devise peut varier selon le contexte de facturation.[2]

L’hypothèse **Supabase ~25 $/mois** est elle aussi défendable. La page de tarification consultée affiche un plan Pro **à partir de 25 $/mois**, avec des compléments possibles selon le compute et l’usage. Là encore, l’ordre de grandeur retenu dans le document est correct.[3]

Enfin, le **coût principal de triage IA par email** est correctement estimé. En reprenant les chiffres du document lui-même, le total est de **0,000333 $ par mail analysé**, ce qui correspond à **0,00030636 €** si l’on reprend le taux de conversion indiqué de **1 USD ≈ 0,92 EUR**. La valeur écrite dans le document, soit **≈ 0,00031 €**, est donc cohérente.[4]

## Ce qui est approximatif ou à reformuler

Le document devient plus fragile lorsqu’il passe des constats documentés aux **hypothèses métier**. C’est particulièrement vrai pour la phrase selon laquelle la part des emails **« actionable »** serait estimée à **30–40%**. Après vérification, la source Microsoft citée ne fournit pas ce chiffre. Cette hypothèse peut être raisonnable pour une modélisation interne, mais elle ne devrait pas être présentée comme un résultat directement établi par l’étude Microsoft.[1]

De la même façon, la phrase **« 117 emails/jour = ~3 500 mails/mois »** est acceptable comme approximation calendaire sur un mois de 30 jours, mais elle n’est pas neutre. Si l’on raisonnait sur des **jours ouvrés**, le volume mensuel serait sensiblement plus bas. Pour un document d’audit, il conviendrait donc de préciser qu’il s’agit d’une extrapolation **sur jours calendaires**, et non d’un volume mensuel observé dans la source.[1]

Le point le plus sensible concerne les **tarifs officiels OpenAI (gpt-4o-mini, 2025)**. Le document donne des valeurs qui sont cohérentes avec des références connues et avec plusieurs références secondaires repérées, mais la page publique de tarification OpenAI consultée au moment du contrôle met désormais surtout en avant les modèles GPT-5.4. Autrement dit, l’ordre de grandeur est plausible, mais pour un audit externe, cette partie devrait être reformulée de façon plus prudente ou accompagnée d’une capture datée / archive de la page concernée.[4] [5]

## Ce qui est faux ou mathématiquement incohérent

L’erreur la plus nette du document porte sur les **coûts unitaires des actions IA secondaires** exprimés en euros. Pour plusieurs lignes, le document semble utiliser le calcul en **dollars** puis l’étiqueter directement en **euros**, sans appliquer la conversion annoncée de **0,92**. Cela explique un écart systématique.

| Action | Valeur indiquée dans le document | Valeur recalculée avec 1 USD = 0,92 EUR | Verdict |
|---|---:|---:|---|
| Brouillon de réponse | 0,000465 € | 0,0004278 € | Trop élevé |
| Relance générée | 0,000345 € | 0,0003312 € | Trop élevé |
| Résumé de conversation | 0,000405 € | 0,0003864 € | Trop élevé |
| Chat support (1 message) | 0,000225 € | 0,0002208 € | Légèrement trop élevé |
| Brief quotidien | 0,000743 € | 0,0006900 € | Trop élevé |
| Reclassification manuelle | 0,000225 € | 0,0002070 € | Trop élevé |

Cette incohérence a un effet direct sur les marges affichées. Les formules du document sont globalement bien construites, mais les totaux arrondis ne sont pas toujours exacts. Le recalcul à partir **des hypothèses mêmes du document** conduit aux résultats suivants.[4]

| Plan | Total coûts indiqué | Total coûts recalculé | Marge indiquée | Marge recalculée | Conclusion |
|---|---:|---:|---:|---:|---|
| Solo | 2,58 € | 2,59 € | 6,42 € | 6,41 € | Écart mineur |
| Pro | 6,43 € | 6,44 € | 12,57 € | 12,56 € | Écart mineur |
| Business / siège, 3 sièges | 5,60 € | 5,60 € | 3,40 € | 3,40 € | Correct |

Les **écarts mineurs** sur Solo et Pro ne changent pas la conclusion économique générale. En revanche, les projections de marge Business pour les équipes plus larges sont réellement trop optimistes.

| Taille équipe Business | % marge indiqué | % marge recalculé | Conclusion |
|---|---:|---:|---|
| 3 sièges | 38% | 37,7% | Correct après arrondi |
| 10 sièges | 41% | 39,1% | Surévalué |
| 50 sièges | 43% | 39,6% | Surévalué |

Autrement dit, la logique selon laquelle la marge Business **s’améliore** avec la dilution du frais fixe Paddle est juste, mais l’ampleur de l’amélioration affichée dans le document n’est pas correcte avec les chiffres retenus.[2] [4]

## Conclusion pratique

Si votre question est simplement **« est-ce exact ? »**, la réponse la plus juste est la suivante : **non, pas totalement**. Le document est **sérieux dans sa structure**, et plusieurs points clés sont **corrects ou proches du vrai**, mais il contient des **approximations non signalées** et quelques **erreurs chiffrées** qu’il faudrait corriger avant de le présenter comme un audit externe.

Pour être publiable en l’état, je recommanderais de faire trois corrections. Premièrement, il faut **corriger tous les coûts secondaires OpenAI en euros**. Deuxièmement, il faut **réviser les marges Business à 10 et 50 sièges**. Troisièmement, il faut **requalifier l’hypothèse des 30–40% d’emails actionnables** comme hypothèse interne, et non comme fait établi par Microsoft.[1] [4]

## Références

[1]: https://news.microsoft.com/de-ch/2025/06/17/new-microsoft-study-reveals-the-rise-of-the-infinite-workday-40-of-employees-check-email-before-6-a-m-evening-meetings-up-16/ "New Microsoft Study Reveals the Rise of the 'Infinite Workday'"
[2]: https://www.paddle.com/pricing "All-in-One Pricing, No Hidden Costs | Paddle"
[3]: https://supabase.com/pricing "Pricing & Fees | Supabase"
[4]: file:///home/ubuntu/recalc_inboria.py "Recalcul interne à partir des hypothèses du document"
[5]: https://openai.com/api/pricing/ "OpenAI API Pricing"
