import { Check, Zap, Sparkles, Users } from "lucide-react";

export const plans = [
  {
    id: "essai",
    name: "Essai",
    price: "gratuit",
    quota: 100,
    description: "100 crédits IA offerts pour découvrir Inboria",
    features: [
      "100 crédits IA offerts (usage unique)",
      "3 rubriques personnalisées",
      "Support par email",
      "Brouillons IA inclus",
    ],
    icon: Check,
  },
  {
    id: "solo",
    name: "Solo",
    price: "9",
    quota: 3000,
    description: "Pour les indépendants",
    features: [
      "3 000 crédits IA / mois",
      "Rubriques illimitées",
      "Brief quotidien",
      "Brouillons IA proactifs",
      "Extraction automatique des tâches",
      "Support prioritaire",
      "Dépassement : 0,002€ / crédit",
    ],
    icon: Zap,
  },
  {
    id: "pro",
    name: "Pro",
    price: "19",
    quota: 10000,
    description: "Idéal pour les professionnels",
    features: [
      "10 000 crédits IA / mois",
      "Rubriques illimitées",
      "Brief quotidien",
      "Brouillons IA proactifs",
      "Extraction automatique des tâches",
      "Statistiques détaillées",
      "Support prioritaire",
      "Dépassement : 0,001€ / crédit",
    ],
    icon: Sparkles,
  },
  {
    id: "business",
    name: "Business",
    price: "9",
    quota: 10000,
    description: "Pour les équipes",
    features: [
      "10 000 crédits IA / siège / mois",
      "Tout du plan Pro inclus",
      "Minimum 3 sièges, jusqu'à 50",
      "Boîtes partagées entre collègues",
      "Assignation de tâches entre membres",
      "API dédiée",
      "Support prioritaire",
      "Dépassement : 0,001€ / crédit",
    ],
    icon: Users,
    hasSeats: true,
  },
] as const;

export type PlanId = (typeof plans)[number]["id"];
