import { Link } from "wouter";
import { MarketingLayout } from "@/components/layout/marketing-layout";
import {
  Building2,
  Users,
  MailPlus,
  MessageSquare,
  UserPlus,
  Bell,
  Activity,
  Shield,
  Crown,
  ArrowRight,
  CheckCircle2,
  Zap,
} from "lucide-react";

const heroStats = [
  { value: "Illimité", label: "membres d'équipe" },
  { value: "IA intégrée", label: "tri & résumés automatiques" },
  { value: "Temps réel", label: "collaboration & notifications" },
];

const capabilities = [
  {
    icon: Zap,
    title: "Intelligence artificielle au service de l'équipe",
    desc: "L'IA de NCV Mail travaille pour toute votre équipe : elle trie automatiquement les emails entrants, génère des résumés instantanés, détecte les priorités et prépare des brouillons de réponse. Que ce soit dans vos boîtes personnelles ou partagées, chaque email est analysé et catégorisé avant même que vous n'ouvriez votre messagerie.",
    highlights: [
      "Tri et catégorisation automatiques par IA",
      "Résumés intelligents des longs échanges",
      "Brouillons de réponse contextuels",
      "Détection de priorité et extraction de tâches",
    ],
  },
  {
    icon: Building2,
    title: "Organisation centralisée",
    desc: "Créez votre organisation en un clic et rassemblez toute votre équipe sous un même toit. Chaque collaborateur dispose de son propre accès tout en partageant les ressources communes.",
    highlights: [
      "Création d'organisation instantanée",
      "Gestion des sièges et des accès",
      "Vue unifiée de l'activité de l'équipe",
    ],
  },
  {
    icon: Crown,
    title: "Rôles et permissions",
    desc: "Structurez votre équipe avec des rôles clairs. Les administrateurs gèrent les membres et les paramètres, tandis que les membres se concentrent sur leur travail.",
    highlights: [
      "Rôles admin et membre",
      "Invitations par email avec lien sécurisé",
      "Gestion des accès en temps réel",
    ],
  },
  {
    icon: MailPlus,
    title: "Boîtes mail partagées",
    desc: "Créez des boîtes de réception communes pour vos adresses génériques (contact@, support@, facturation@). Chaque membre de l'équipe peut consulter, revendiquer et traiter les emails entrants.",
    highlights: [
      "Boîtes partagées illimitées",
      "Système de revendication d'emails",
      "Visibilité sur qui traite quoi",
    ],
  },
  {
    icon: MessageSquare,
    title: "Notes internes sur les emails",
    desc: "Collaborez directement sur les emails en ajoutant des commentaires privés visibles uniquement par votre équipe. Fini les transferts inutiles et les \"tu as vu cet email ?\" sur Slack.",
    highlights: [
      "Commentaires contextuels par email",
      "Historique complet des échanges internes",
      "Modification et suppression de ses notes",
    ],
  },
  {
    icon: UserPlus,
    title: "Assignation intelligente",
    desc: "Distribuez le travail efficacement en assignant chaque email au bon collaborateur. Le responsable reçoit une notification et retrouve ses emails assignés dans une vue dédiée.",
    highlights: [
      "Assignation en un clic",
      "Vue \"Mes emails assignés\"",
      "Réassignation et désassignation flexibles",
    ],
  },
  {
    icon: Bell,
    title: "Notifications en temps réel",
    desc: "Ne manquez rien : chaque assignation ou commentaire déclenche une notification instantanée. La cloche dans votre sidebar vous tient informé sans quitter votre boîte de réception.",
    highlights: [
      "Notifications automatiques",
      "Badge de compteur non-lus",
      "Marquage lu individuel ou groupé",
    ],
  },
  {
    icon: Activity,
    title: "Tableau de bord d'activité",
    desc: "Suivez la performance de votre équipe en un coup d'œil : emails assignés, traités, commentés. Un fil d'activité chronologique vous montre qui fait quoi, en temps réel.",
    highlights: [
      "Statistiques par membre",
      "Fil d'activité en direct",
      "Métriques d'assignation et de traitement",
    ],
  },
];

const workflow = [
  {
    step: "1",
    title: "Créez votre organisation",
    desc: "Nommez votre entreprise et activez le plan Business.",
  },
  {
    step: "2",
    title: "Invitez vos collègues",
    desc: "Envoyez des invitations par email. Ils rejoignent en un clic.",
  },
  {
    step: "3",
    title: "Configurez vos boîtes partagées",
    desc: "Créez vos adresses communes et ajoutez les membres concernés.",
  },
  {
    step: "4",
    title: "Collaborez sans effort",
    desc: "Assignez, commentez, suivez l'activité. L'IA s'occupe du reste.",
  },
];

export default function Entreprise() {
  return (
    <MarketingLayout>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#2d7dd2]/10 via-[#2d7dd2]/5 to-transparent" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center relative">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#2d7dd2]/10 border border-[#2d7dd2]/20 mb-6">
            <Building2 className="w-3.5 h-3.5 text-[#2d7dd2]" />
            <span className="text-[12px] font-medium text-[#2d7dd2]">Plan Business</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight">
            Votre équipe, une seule<br className="hidden sm:block" /> boîte de réception
          </h1>
          <p className="mt-5 text-[15px] sm:text-[16px] text-[#8b9cb3] max-w-2xl mx-auto leading-relaxed">
            NCV Mail combine intelligence artificielle et collaboration d'équipe 
            pour une gestion des emails sans effort. L'IA trie, résume et prépare vos réponses 
            tandis que votre équipe collabore via boîtes partagées, assignation et commentaires internes.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/tarifs">
              <button className="px-8 py-3 text-[14px] font-semibold text-white bg-[#2d7dd2] rounded-lg hover:bg-[#2563b1] transition-colors flex items-center gap-2">
                Choisir le plan Business
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <Link href="/tarifs">
              <button className="px-8 py-3 text-[14px] font-semibold text-[#8b9cb3] border border-[#1f2937] rounded-lg hover:text-white hover:border-[#2d7dd2]/30 transition-colors">
                Comparer les plans
              </button>
            </Link>
          </div>

          <div className="mt-12 grid grid-cols-3 gap-6 max-w-lg mx-auto">
            {heroStats.map((s) => (
              <div key={s.label}>
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-[11px] text-[#8b9cb3] mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#1f2937]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Tout pour collaborer efficacement
            </h2>
            <p className="mt-3 text-[14px] text-[#8b9cb3] max-w-xl mx-auto">
              Des outils conçus pour les PME qui veulent structurer leur gestion des emails sans complexité.
            </p>
          </div>

          <div className="space-y-6">
            {capabilities.map((cap, i) => (
              <div
                key={cap.title}
                className="rounded-xl border border-[#1f2937] bg-[#141c2b] p-6 sm:p-8 hover:border-[#2d7dd2]/30 transition-colors"
              >
                <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-[#2d7dd2]/10 flex items-center justify-center shrink-0">
                        <cap.icon className="w-5 h-5 text-[#2d7dd2]" />
                      </div>
                      <h3 className="text-[16px] font-semibold text-white">{cap.title}</h3>
                    </div>
                    <p className="text-[13px] text-[#8b9cb3] leading-relaxed">{cap.desc}</p>
                  </div>
                  <div className="lg:w-64 shrink-0">
                    <ul className="space-y-2">
                      {cap.highlights.map((h) => (
                        <li key={h} className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-[#2d7dd2] mt-0.5 shrink-0" />
                          <span className="text-[12px] text-[#8b9cb3]">{h}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#1f2937] bg-[#0a0e14]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Opérationnel en 4 étapes
            </h2>
            <p className="mt-3 text-[14px] text-[#8b9cb3]">
              De la création de votre organisation à la collaboration quotidienne.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {workflow.map((w) => (
              <div key={w.step} className="text-center">
                <div className="w-12 h-12 rounded-full bg-[#2d7dd2]/10 border border-[#2d7dd2]/20 flex items-center justify-center mx-auto mb-4">
                  <span className="text-[16px] font-bold text-[#2d7dd2]">{w.step}</span>
                </div>
                <h3 className="text-[14px] font-semibold text-white mb-2">{w.title}</h3>
                <p className="text-[12px] text-[#8b9cb3] leading-relaxed">{w.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#1f2937]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="rounded-2xl border border-[#2d7dd2]/20 bg-gradient-to-br from-[#141c2b] to-[#0d1117] p-8 sm:p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-[#2d7dd2]/10 flex items-center justify-center mx-auto mb-6">
              <Zap className="w-7 h-7 text-[#2d7dd2]" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Prêt à transformer la gestion email de votre équipe ?
            </h2>
            <p className="mt-4 text-[14px] text-[#8b9cb3] max-w-lg mx-auto">
              Rejoignez les PME belges et françaises qui ont déjà adopté NCV Mail 
              pour une collaboration plus fluide et une productivité décuplée.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/tarifs">
                <button className="px-8 py-3 text-[14px] font-semibold text-white bg-[#2d7dd2] rounded-lg hover:bg-[#2563b1] transition-colors">
                  Découvrir le plan Business
                </button>
              </Link>
              <Link href="/tarifs">
                <button className="px-8 py-3 text-[14px] font-semibold text-[#8b9cb3] border border-[#1f2937] rounded-lg hover:text-white transition-colors">
                  Comparer les plans
                </button>
              </Link>
            </div>
            <p className="mt-4 text-[11px] text-[#8b9cb3]/60">
              Plan Business à partir de 49€/mois • Sièges extensibles • Configuration en 2 minutes
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-[#1f2937] bg-[#0a0e14]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Questions fréquentes
            </h2>
          </div>
          <div className="space-y-4">
            {[
              {
                q: "Combien de membres puis-je ajouter à mon équipe ?",
                a: "Le plan Business inclut des sièges de base, et vous pouvez en ajouter autant que nécessaire directement depuis votre portail d'abonnement. Il n'y a pas de limite imposée.",
              },
              {
                q: "Mes collaborateurs ont-ils accès à tous mes emails ?",
                a: "Non, chaque membre conserve ses emails privés. Seuls les emails des boîtes partagées et les emails explicitement assignés sont visibles par l'équipe.",
              },
              {
                q: "Les commentaires internes sont-ils visibles par l'expéditeur de l'email ?",
                a: "Absolument pas. Les commentaires sont strictement internes à votre organisation. L'expéditeur original n'en a jamais connaissance.",
              },
              {
                q: "Puis-je passer du plan Solo au plan Business ?",
                a: "Oui, la mise à niveau est instantanée depuis la page Abonnement de votre tableau de bord. Vos données et paramètres sont conservés.",
              },
              {
                q: "L'IA fonctionne-t-elle aussi sur les boîtes partagées ?",
                a: "Oui, l'intelligence artificielle trie, résume et catégorise tous les emails, y compris ceux des boîtes partagées, de la même manière que pour vos emails personnels.",
              },
            ].map((faq) => (
              <div
                key={faq.q}
                className="rounded-xl border border-[#1f2937] bg-[#141c2b] p-5"
              >
                <h3 className="text-[14px] font-semibold text-white mb-2">{faq.q}</h3>
                <p className="text-[13px] text-[#8b9cb3] leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
