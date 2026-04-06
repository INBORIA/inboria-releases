import { Check, Zap, Sparkles, Users } from "lucide-react";

export const plans = [
  {
    id: "essai",
    name: "Essai",
    price: "gratuit",
    quota: 100,
    description: "100 emails offerts pour decouvrir NCV Mail",
    features: [
      "100 emails offerts (usage unique)",
      "3 rubriques personnalisees",
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
    description: "Pour les independants",
    features: [
      "3 000 emails par mois",
      "Rubriques illimitees",
      "Brief quotidien",
      "Brouillons IA proactifs",
      "Extraction automatique des taches",
      "Support prioritaire",
      "Depassement : 0,002€/email",
    ],
    icon: Zap,
  },
  {
    id: "pro",
    name: "Pro",
    price: "19",
    quota: 10000,
    description: "Ideal pour les professionnels",
    features: [
      "10 000 emails par mois",
      "Rubriques illimitees",
      "Brief quotidien",
      "Brouillons IA proactifs",
      "Extraction automatique des taches",
      "Statistiques detaillees",
      "Support prioritaire",
      "Depassement : 0,001€/email",
    ],
    icon: Sparkles,
  },
  {
    id: "business",
    name: "Business",
    price: "9",
    quota: 10000,
    description: "Pour les equipes",
    features: [
      "10 000 emails tries / siege / mois",
      "Tout du plan Pro inclus",
      "Minimum 3 sieges, jusqu'a 50",
      "Boites partagees entre collegues",
      "Assignation de taches entre membres",
      "API dediee",
      "Support prioritaire",
      "Depassement : 0,001€ / email",
    ],
    icon: Users,
    hasSeats: true,
  },
] as const;

export type PlanId = (typeof plans)[number]["id"];
