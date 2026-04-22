# Vérification directe des fournisseurs cités dans le rapport Inboria

Vous aviez raison de demander une vérification directe. Cette note ne repose plus sur une simple lecture interne du rapport, mais sur un contrôle des **pages officielles** des fournisseurs cités.

## Verdict rapide

| Fournisseur | Hypothèse du rapport | Vérification directe | Verdict |
|---|---|---|---:|
| **OpenAI** | `gpt-4o-mini` à **0,15 $ / 1M input** et **0,60 $ / 1M output** | La page officielle du modèle affiche bien **$0.15 input** et **$0.6 output** [1] | **Correct** |
| **Paddle** | **5 % + 0,50 €** par transaction | La page officielle affiche **5% + 50¢ per Checkout transaction** [2] | **Correct en ordre de grandeur** |
| **Supabase Pro** | **23 € / mois** | La page officielle affiche **From $25 / month** [3] | **Approximatif mais défendable** |
| **Supabase Team** | **100 € / mois** | La page officielle affiche **From $599 / month** [3] | **Faux** |
| **Replit Reserved VM** | **25 € / mois** | La page publique actuelle de pricing Replit montre surtout **Core $20/mois** et **Pro $100/mois**, sans confirmer ce poste précis [4] | **Non vérifié / fragile** |
| **Brevo SMTP Lite / Premium** | **9 €** puis **25 €** | La page officielle consultée ne confirme pas directement ces deux montants exacts dans la vue lue [5] | **Non vérifié tel quel** |

## Lecture détaillée

### OpenAI

Sur ce point, le rapport est **bon**. La page officielle du modèle **GPT-4o mini** affiche directement un prix de **$0.15** en entrée et **$0.6** en sortie par million de tokens [1]. Cela valide l’hypothèse centrale de coût IA utilisée dans le rapport.

### Paddle

Sur les frais de paiement, le rapport est également **correct dans son ordre de grandeur**. Paddle affiche officiellement une formule **5% + 50¢ par transaction Checkout** [2]. Si le rapport raisonne ensuite en euros sans retraitement précis du change, cela reste acceptable pour une simulation simple.

### Supabase

C’est ici que le rapport devient **problématique**. Le plan **Pro** public affiché par Supabase est **à partir de 25 $/mois** [3], donc l’hypothèse de **23 €** reste encore approximativement défendable selon le change. En revanche, le plan **Team** public affiché est **à partir de 599 $/mois** [3], ce qui contredit nettement l’hypothèse du rapport de **100 € / mois**. Si la ligne “Team = 100 €” n’est pas tirée d’une offre spécifique interne ou ancienne, elle est **fausse au regard de la page officielle actuelle**.

### Replit

Le rapport cite **Replit Deployments (Reserved VM)** à **25 €**. Or la page publique de tarification Replit consultée affiche principalement **Core à $20/mois** et **Pro à $100/mois**, avec crédits mensuels inclus, sans confirmer explicitement un poste **Reserved VM à 25 €** [4]. Cela ne prouve pas automatiquement que le rapport est faux, mais cela veut dire que **ce chiffre n’est pas vérifié par la source publique standard**. Pour un rapport externe, cette ligne est donc **fragile** tant qu’elle n’est pas rattachée à une page produit ou facture précise.

### Brevo

Le rapport suppose **9 €** puis **25 €** pour les paliers SMTP. La page officielle consultée affiche bien l’existence de paliers de volume email et d’une tarification de départ, mais dans la vue lue elle ne confirme pas directement les deux montants exacts utilisés par le rapport [5]. Là encore, cela ne suffit pas pour dire que le rapport est automatiquement faux, mais **ce n’est pas proprement sourcé** dans sa forme actuelle.

## Ce que cela change pour le rapport

| Partie du rapport | Situation après vérification directe |
|---|---|
| **Coût OpenAI** | **Validé** |
| **Frais Paddle** | **Validés en pratique** |
| **Supabase Pro** | **Tolérable** |
| **Supabase Team** | **À corriger impérativement** |
| **Replit** | **À resourcer ou reformuler** |
| **Brevo** | **À resourcer ou reformuler** |

## Mon verdict corrigé

> Vous aviez raison : il fallait **vérifier les fournisseurs directement** avant de conclure.

Après vérification directe, ma position corrigée est la suivante : le rapport est **partiellement exact**, mais **pas entièrement fiable pour diffusion externe** tant que les hypothèses **Supabase Team**, **Replit**, et **Brevo** ne sont pas resourcées proprement.

La partie la plus importante est la suivante :

> **Le cœur du modèle de coût IA semble correct côté OpenAI et Paddle, mais une partie des coûts fixes d’infrastructure n’est pas correctement sécurisée par les sources publiques actuelles.**

## Références

[1]: https://developers.openai.com/api/docs/models/gpt-4o-mini "GPT-4o mini Model | OpenAI API"
[2]: https://www.paddle.com/pricing "All-in-One Pricing, No Hidden Costs | Paddle"
[3]: https://supabase.com/pricing "Pricing & Fees | Supabase"
[4]: https://replit.com/pricing "Pricing - Replit"
[5]: https://www.brevo.com/pricing/ "Pricing Plans | Brevo"
