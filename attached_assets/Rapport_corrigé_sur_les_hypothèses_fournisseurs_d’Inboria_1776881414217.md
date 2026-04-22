# Rapport corrigé sur les hypothèses fournisseurs d’Inboria

Vous avez raison de demander une révision de mon précédent rapport. Mon observation initiale était **trop sévère sur Supabase** parce qu’elle raisonnait trop vite en scénario de croissance théorique, alors que votre logique correcte est de juger les coûts fixes à partir de la **phase réelle du projet** : aujourd’hui **aucun abonné**, une **bêta privée fermée**, puis un **démarrage commercial progressif**.

## Verdict corrigé

| Poste | Mon avis corrigé |
|---|---|
| **OpenAI** | **Correct** et proprement vérifié sur la source officielle [1] |
| **Paddle** | **Correct en ordre de grandeur**, la formule publique 5 % + 50¢ est bien confirmée [2] |
| **Supabase Pro** | **Oui, hypothèse défendable et cohérente** pour la phase actuelle et le proche horizon [3] |
| **Supabase Team** | La correction du rapport est bonne : il ne faut **pas** l’utiliser comme coût de référence actuel [3] |
| **Replit** | Plausible, mais encore **estimatif** tant qu’il n’y a pas de facture ou page produit plus précise [4] |
| **Brevo** | Plausible en paliers, mais encore **semi-estimatif** sans capture tarifaire exacte ou facture [5] |

## Ce que je corrige dans mon jugement

Dans mon rapport précédent, j’avais raison de signaler que **Supabase Team à 100 €** n’était pas conforme à la page officielle actuelle. En revanche, j’ai été **trop rigide** en laissant entendre que cela fragilisait fortement toute la partie “croissance” du document.

La bonne lecture est la suivante.

> **Si l’objectif du rapport est d’évaluer la soutenabilité de la phase bêta, du lancement et du proche horizon commercial, alors retenir Supabase Pro comme coût fixe principal est logique et prudent.**

La page officielle Supabase indique que le plan **Pro** commence à **25 $/mois** et couvre jusqu’à **100 000 MAU**, avec des ressources déjà significatives [3]. Pour une application qui n’a **pas encore d’abonnés** et qui raisonne d’abord sur les **premiers clients payants**, votre position selon laquelle **le plan Pro suffit largement** est cohérente.

Autrement dit, le rapport n’a pas besoin d’intégrer un coût **Team** comme si celui-ci était imminent. Il suffit de dire clairement que :

> **le plan Team n’est pas retenu dans les projections de court terme, car il ne correspond ni à la situation actuelle ni à l’horizon réaliste des premiers mois de commercialisation.**

## Ce qui devient acceptable dans votre rapport

| Élément | Appréciation corrigée |
|---|---|
| **Supabase en bêta / lancement** | **Oui, crédible** |
| **Supabase Pro maintenu en croissance initiale** | **Oui, défendable** si l’on parle de croissance réaliste et non d’hyperscale immédiat |
| **Retrait de Supabase Team des coûts projetés** | **Bonne correction** |
| **Conclusion “coûts fixes maîtrisés”** | **Oui, globalement défendable** avec cette logique de phase |

## Ce que je maintiens comme réserve

Le point à corriger n’est donc **plus** principalement Supabase. Les réserves résiduelles portent plutôt sur la **qualité de preuve** de certains autres postes.

### Replit

La page publique Replit consultée confirme bien l’existence d’un plan **Core à 20 $/mois**, mais le chiffrage précis de la **Reserved VM** n’était pas confirmé aussi proprement par la source publique consultée [4]. Donc la ligne “Core + Reserved VM ~25 $” peut être **plausible**, mais elle reste une **approximation** si vous n’avez pas une facture, un devis ou une page produit plus précise.

### Brevo

Même logique pour Brevo. L’existence de paliers et d’une montée en coût avec le volume d’envoi est cohérente, mais les montants exacts que vous affichez dans le rapport restent mieux présentables s’ils sont soutenus par une capture tarifaire ou une facture de référence [5].

## Mon avis corrigé sur le rapport

> **Avec votre logique de phase actuelle, le traitement de Supabase devient correct et même plus raisonnable que ce que j’avais laissé entendre.**

Je reformulerais donc mon verdict ainsi : le rapport est **globalement crédible pour un document interne sérieux, ou pour un auditeur / conseil lisant un projet en phase bêta-lancement**, à condition de comprendre que les coûts d’infrastructure sont présentés selon un **horizon réaliste de démarrage** et non comme une architecture cible d’hypercroissance.

## Verdict final corrigé

| Question | Réponse corrigée |
|---|---|
| **Ai-je été trop sévère sur Supabase ?** | **Oui** |
| **Votre logique “Supabase Pro suffit largement pour l’instant” est-elle bonne ?** | **Oui** |
| **Le rapport devient-il plus défendable avec cette logique ?** | **Oui, nettement** |
| **Reste-t-il des points fragiles ?** | **Oui : surtout Replit et Brevo, plus par niveau de preuve que par absurdité économique** |

En résumé, je corrige donc mon jugement précédent de la façon suivante :

> **Le point Supabase n’est plus une objection sérieuse si l’on raisonne correctement à l’échelle actuelle du projet. Le rapport est plus solide que je ne l’avais dit, et la critique principale doit désormais porter surtout sur la documentation probante de Replit et de Brevo, pas sur le choix de garder Supabase Pro.**

## References

[1]: https://developers.openai.com/api/docs/models/gpt-4o-mini "GPT-4o mini Model | OpenAI API"
[2]: https://www.paddle.com/pricing "All-in-One Pricing, No Hidden Costs | Paddle"
[3]: https://supabase.com/pricing "Pricing & Fees | Supabase"
[4]: https://replit.com/pricing "Pricing - Replit"
[5]: https://www.brevo.com/pricing/ "Pricing Plans | Brevo"
