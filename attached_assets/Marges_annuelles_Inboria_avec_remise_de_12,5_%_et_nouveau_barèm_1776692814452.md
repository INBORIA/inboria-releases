# Marges annuelles Inboria avec remise de 12,5 % et nouveau barème de crédits

J’ai recalculé les marges en prenant en compte le **prix annuel avec 12,5 % de remise** ainsi que le **nouveau barème de crédits par action IA** que vous avez fourni.

## Hypothèse de calcul retenue

Le point important est que votre nouveau barème **ne facture plus explicitement les mails envoyés via Brevo en crédits**, alors que l’ancien modèle profilé de la révision 5 intégrait **10 crédits par mail envoyé**. C’est donc l’effet le plus structurant et le plus certain dans le recalcul.

J’ai donc utilisé un scénario prudent :

| Hypothèse | Valeur retenue |
|---|---:|
| Remise annuelle | **12,5 %** |
| Solo annuel | **94,50 € / an** soit **7,88 € / mois équivalent** |
| Pro annuel | **199,50 € / an** soit **16,63 € / mois équivalent** |
| Business annuel | **136,40 € / siège / an** soit **11,37 € / mois équivalent** |
| Frais de paiement | annualisés sur 12 mois |
| Infra | hypothèse early stage de la rev. 5 : **1,55 € / utilisateur / mois** |
| Coûts variables par profil | repris de la rev. 5 : **Light 0,58 €**, **Median 2,62 €**, **Heavy 6,59 €** |

Pour la consommation de crédits, j’ai repris les profils de la rev. 5 et j’ai appliqué l’ajustement quantifiable certain suivant :

> **suppression des 10 crédits par mail envoyé**

J’ai ajouté en plus **90 crédits/mois** pour le résumé quotidien s’il est généré chaque jour.

## Crédits mensuels recalculés par profil

| Profil | Ancien total | Ajustement | Nouveau total estimé |
|---|---:|---:|---:|
| Light | 2 311 | −900 + 90 | **1 501** |
| Median | 9 274 | −4 800 + 90 | **4 564** |
| Heavy | 18 279 | −10 500 + 90 | **7 869** |

## Marges annuelles recalculées

### Solo annuel

| Profil | Crédits/mois | Dépassement | Revenu mensuel équiv. | Coût total | Marge | % marge |
|---|---:|---:|---:|---:|---:|---:|
| Light | 1 501 | 0 | **7,88 €** | 2,57 € | **5,31 €** | **67,42 %** |
| Median | 4 564 | 1 564 | **11,00 €** | 4,61 € | **6,40 €** | **58,14 %** |
| Heavy | 7 869 | 4 869 | **17,61 €** | 8,58 € | **9,04 €** | **51,31 %** |

### Pro annuel

| Profil | Crédits/mois | Dépassement | Revenu mensuel équiv. | Coût total | Marge | % marge |
|---|---:|---:|---:|---:|---:|---:|
| Light | 1 501 | 0 | **16,63 €** | 3,00 € | **13,62 €** | **81,94 %** |
| Median | 4 564 | 0 | **16,63 €** | 5,04 € | **11,58 €** | **69,67 %** |
| Heavy | 7 869 | 0 | **16,63 €** | 9,01 € | **7,61 €** | **45,79 %** |

### Business annuel par siège, équipe de 3

| Profil | Crédits/mois | Dépassement | Revenu mensuel équiv. / siège | Coût total / siège | Marge / siège | % marge |
|---|---:|---:|---:|---:|---:|---:|
| Light | 1 501 | 0 | **11,37 €** | 2,71 € | **8,65 €** | **76,14 %** |
| Median | 4 564 | 0 | **11,37 €** | 4,75 € | **6,61 €** | **58,19 %** |
| Heavy | 7 869 | 0 | **11,37 €** | 8,72 € | **2,64 €** | **23,26 %** |

## Lecture business

Le résultat le plus important est le suivant :

> **avec ce nouveau barème, mais sans crédit dédié pour les mails envoyés via Brevo, le nombre de crédits consommés baisse fortement pour les profils intensifs.**

Cela produit trois effets :

| Effet | Conséquence |
|---|---|
| Solo | reste rentable, mais la marge baisse sur les usages lourds |
| Pro | reste rentable, mais un heavy user ne paie plus de dépassement dans ce scénario |
| Business | reste rentable, mais la marge heavy devient **très comprimée** |

## Conclusion nette

Ma conclusion est simple :

> **Oui, le nouveau barème a du sens produit.**
> **Mais non, il ne protège pas assez la marge si vous ne comptez plus les envois sortants ou une mécanique équivalente.**

Autrement dit, avec ce barème seul :

| Décision | Mon avis |
|---|---|
| Compter les actions IA visibles en crédits | **Oui** |
| Faire un annuel à -12,5 % | **Oui** |
| Ne plus faire payer du tout la partie envois / follow-up / outbound | **Non recommandé** |

## Ma recommandation

Si vous gardez ce barème, je vous conseille d’ajouter **au moins un des trois garde-fous suivants** :

| Option | Effet |
|---|---|
| Crédit sur les mails envoyés | protège Brevo et les gros utilisateurs |
| Crédit sur la détection de relances + génération de relance + extraction RDV avec volumes bien suivis | protège partiellement le coût usage avancé |
| Quota Business un peu plus bas ou prix Business annuel légèrement plus haut | évite l’écrasement de marge sur les heavy users |

La synthèse la plus honnête est donc :

> **Annuel -12,5 % : oui.**
> **Barème d’actions IA : oui.**
> **Mais il faut encore monétiser l’outbound ou un équivalent, sinon le plan Business annuel devient trop fragile sur les gros usages.**
