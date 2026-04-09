import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  Inbox,
  Archive,
  LayoutDashboard,
  CheckSquare,
  FolderKanban,
  Tags,
  Settings,
  CreditCard,
  Users,
  MailPlus,
  Activity,
  BookOpen,
  ChevronRight,
  Send,
  Bell,
  Paperclip,
} from "lucide-react";
import { Link } from "wouter";
import { useGetProfile, useGetMyOrganisation } from "@workspace/api-client-react";

const sections = [
  {
    icon: Inbox,
    name: "Réception",
    href: "/dashboard",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
    description:
      "Votre boîte de réception intelligente. Tous vos emails sont automatiquement triés par priorité (urgent, moyen, faible) et classés par catégorie grâce à l'IA.",
    features: [
      "Tri automatique par priorité avec code couleur",
      "Résumé IA de chaque email en une phrase",
      "Recherche rapide par mot-clé",
      "Synchronisation automatique (toutes les 5 min) avec Gmail, Outlook et IMAP",
      "Pagination : chargement par lots de 50 emails pour une navigation fluide",
      "Sélection multiple pour archiver, supprimer ou marquer comme lu",
      "Assignation d'emails à un collègue (plan Business)",
      "Onglet Boîtes partagées pour voir et prendre en charge les emails d'équipe",
      "Affichage HTML complet des emails (mise en forme, images, boutons)",
      "Simulateur d'email pour tester le tri IA",
      "Nouveau message : composer et envoyer un email directement",
    ],
  },
  {
    icon: Paperclip,
    name: "Pièces jointes",
    href: "/dashboard",
    color: "text-sky-400",
    bgColor: "bg-sky-500/10",
    borderColor: "border-sky-500/20",
    description:
      "Gérez les pièces jointes de vos emails en réception et en envoi. Visualisez, téléchargez et joignez des fichiers facilement.",
    features: [
      "Détection automatique des pièces jointes à la réception (Gmail et IMAP)",
      "Indicateur visuel (trombone + compteur) sur les emails avec pièces jointes",
      "Téléchargement des pièces jointes en un clic",
      "Aperçu inline des images directement dans l'email",
      "Les PDF s'ouvrent dans un nouvel onglet",
      "Joindre des fichiers lors de l'envoi ou de la réponse (bouton Joindre)",
      "Jusqu'à 10 fichiers par email, 10 Mo maximum par fichier",
      "Suppression individuelle des fichiers joints avant envoi",
    ],
  },
  {
    icon: Send,
    name: "Envoyés",
    href: "/dashboard/envoyes",
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/20",
    description:
      "Retrouvez tous vos emails envoyés et vos réponses. Visualisez les conversations complètes avec l'historique des échanges.",
    features: [
      "Liste de tous vos emails envoyés et réponses",
      "Distinction visuelle entre nouveaux messages et réponses",
      "Vue conversation : tout l'historique d'un échange en un seul endroit",
      "Indicateur de pièces jointes sur les emails envoyés",
      "Créer une tâche de suivi depuis un email envoyé",
      "Accès au résumé IA de chaque email",
    ],
  },
  {
    icon: Archive,
    name: "Archives",
    href: "/dashboard/archives",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
    description:
      "Retrouvez tous vos emails archivés. Un email archivé n'apparaît plus dans la Réception mais reste accessible à tout moment.",
    features: [
      "Liste de tous les emails archivés",
      "Recherche dans les archives",
      "Possibilité de désarchiver un email pour le remettre dans la Réception",
      "Détail complet de chaque email archivé",
    ],
  },
  {
    icon: LayoutDashboard,
    name: "Bilan quotidien",
    href: "/dashboard/bilan",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
    description:
      "Un résumé quotidien de votre activité email. Visualisez en un coup d'œil l'état de votre boîte et les tendances.",
    features: [
      "Compteurs : emails urgents, moyens, faibles",
      "Santé de la boîte de réception (score en %)",
      "Statistiques par catégorie",
      "Évolution du volume d'emails dans le temps",
      "Vue d'ensemble pour prioriser votre journée",
    ],
  },
  {
    icon: CheckSquare,
    name: "Tâches",
    href: "/dashboard/taches",
    color: "text-violet-400",
    bgColor: "bg-violet-500/10",
    borderColor: "border-violet-500/20",
    description:
      "Gestion des tâches extraites automatiquement de vos emails par l'IA. Chaque email contenant une action concrète génère une tâche.",
    features: [
      "Tâches auto-générées par l'IA depuis vos emails",
      "Lien direct vers l'email source de chaque tâche",
      "Cocher / décocher une tâche comme faite",
      "Supprimer les tâches terminées ou inutiles",
      "Créer une tâche de suivi depuis un email envoyé",
      "Suivi de votre productivité",
    ],
  },
  {
    icon: FolderKanban,
    name: "Projets",
    href: "/dashboard/projets",
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/20",
    description:
      "Regroupez vos emails par projet pour mieux organiser votre travail. Créez des projets et associez-y des emails.",
    features: [
      "Créer, renommer et supprimer des projets",
      "Associer un email à un projet depuis la Réception",
      "Voir tous les emails d'un projet en un clic",
      "Compteur d'emails par projet",
    ],
  },
  {
    icon: Tags,
    name: "Classement",
    href: "/dashboard/classement",
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/20",
    description:
      "Gérez vos catégories d'emails. L'IA crée automatiquement des catégories pertinentes, mais vous pouvez les personnaliser. Choisissez parmi 50 packs métiers prédéfinis.",
    features: [
      "Liste de toutes vos catégories avec compteurs",
      "Créer de nouvelles catégories manuellement",
      "Renommer ou supprimer une catégorie",
      "Re-catégoriser les emails « non classés » en un clic",
      "50 packs métiers prédéfinis (comptabilité, immobilier, avocat, e-commerce…)",
      "L'IA apprend de vos corrections pour s'améliorer",
    ],
  },
  {
    icon: Bell,
    name: "Notifications",
    href: "/dashboard",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/20",
    description:
      "Restez informé de toute activité importante. Les notifications vous alertent des emails urgents, des assignations et des actions d'équipe.",
    features: [
      "Cloche de notification avec compteur de non-lus",
      "Notifications pour les emails urgents reçus",
      "Notifications d'assignation d'email (plan Business)",
      "Marquer une notification comme lue ou tout marquer comme lu",
      "Historique des notifications récentes",
    ],
  },
  {
    icon: Settings,
    name: "Paramètres",
    href: "/dashboard/parametres",
    color: "text-gray-400",
    bgColor: "bg-gray-500/10",
    borderColor: "border-gray-500/20",
    description:
      "Configurez votre compte, connectez vos boîtes email et personnalisez vos préférences.",
    features: [
      "Modifier votre nom, langue et signature email",
      "Connecter plusieurs comptes email (Gmail, Outlook, IMAP)",
      "Possibilité de connecter plusieurs comptes du même fournisseur",
      "Déconnecter un compte email spécifique",
      "Gérer les intégrations (Slack, Notion)",
      "Définir des règles IA personnalisées (priorité/catégorie par expéditeur)",
    ],
  },
  {
    icon: CreditCard,
    name: "Abonnement",
    href: "/dashboard/abonnement",
    color: "text-pink-400",
    bgColor: "bg-pink-500/10",
    borderColor: "border-pink-500/20",
    description:
      "Gérez votre plan d'abonnement NCV Mail. Comparez les offres et passez à un plan supérieur.",
    features: [
      "3 plans : Solo (9€/mois), Pro (29€/mois), Business (59€/mois)",
      "Essai gratuit de 100 emails inclus",
      "Paiement sécurisé via Stripe",
      "Voir votre quota et votre consommation actuelle",
      "Changer de plan à tout moment",
    ],
  },
];

const businessSections = [
  {
    icon: Users,
    name: "Mon équipe",
    href: "/dashboard/equipe",
    color: "text-indigo-400",
    bgColor: "bg-indigo-500/10",
    borderColor: "border-indigo-500/20",
    description:
      "Gérez les membres de votre organisation. Invitez des collègues, attribuez des rôles et collaborez sur vos emails.",
    features: [
      "Inviter des membres par email",
      "Rôles : admin (gestion complète) et membre (accès limité)",
      "Voir la liste de tous les membres actifs",
      "Retirer un membre de l'organisation",
      "Créer votre organisation si elle n'existe pas encore",
    ],
  },
  {
    icon: MailPlus,
    name: "Boîtes partagées",
    href: "/dashboard/boites-partagees",
    color: "text-teal-400",
    bgColor: "bg-teal-500/10",
    borderColor: "border-teal-500/20",
    description:
      "Partagez des boîtes email avec votre équipe. L'admin partage une connexion email existante, et les membres peuvent voir et prendre en charge les emails.",
    features: [
      "L'admin partage une de ses connexions email comme boîte partagée",
      "Ajouter ou retirer des membres d'une boîte partagée",
      "Les membres voient les emails partagés dans l'onglet Réception > Boîtes partagées",
      "Prendre en charge (claim) un email pour signaler qu'on s'en occupe",
      "Libérer un email pris en charge",
      "Compteur d'emails non pris en charge",
    ],
  },
  {
    icon: Activity,
    name: "Activité équipe",
    href: "/dashboard/activite-equipe",
    color: "text-rose-400",
    bgColor: "bg-rose-500/10",
    borderColor: "border-rose-500/20",
    description:
      "Suivez l'activité de votre équipe en temps réel. Voyez qui fait quoi et suivez les actions importantes.",
    features: [
      "Journal d'activité en temps réel",
      "Voir les actions de chaque membre (emails lus, archivés, assignés…)",
      "Filtrer par membre ou par type d'action",
      "Historique complet des actions de l'équipe",
    ],
  },
];

function SectionCard({ section }: { section: typeof sections[0] }) {
  const Icon = section.icon;
  return (
    <div className={`rounded-xl border ${section.borderColor} ${section.bgColor} p-5 transition-all hover:shadow-lg hover:shadow-black/20`}>
      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 rounded-lg ${section.bgColor} border ${section.borderColor} flex items-center justify-center shrink-0`}>
          <Icon className={`w-5 h-5 ${section.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[15px] font-semibold text-white">{section.name}</h3>
            <Link
              href={section.href}
              className={`flex items-center gap-1 text-[11px] ${section.color} hover:text-white transition-colors`}
            >
              Ouvrir
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <p className="text-[12px] text-[#8b9cb3] leading-relaxed mb-3">
            {section.description}
          </p>
          <ul className="space-y-1.5">
            {section.features.map((feature, i) => (
              <li key={i} className="flex items-start gap-2">
                <div className={`w-1 h-1 rounded-full ${section.color.replace("text-", "bg-")} mt-1.5 shrink-0`} />
                <span className="text-[11px] text-[#8b9cb3]/90 leading-relaxed">{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function Manuel() {
  const { data: profile } = useGetProfile();
  const { data: org } = useGetMyOrganisation();
  const plan = (profile as any)?.plan;
  const isBusiness = plan === "business";

  return (
    <DashboardLayout>
      <div className="p-5 max-w-[900px] mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-[18px] font-bold text-white">Manuel d'utilisation</h1>
              <p className="text-[12px] text-[#8b9cb3]">
                Découvrez toutes les fonctionnalités de NCV Mail
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {sections.map((section) => (
            <SectionCard key={section.name} section={section} />
          ))}

          {isBusiness && (
            <>
              <div className="flex items-center gap-3 mt-8 mb-2">
                <div className="h-px flex-1 bg-[#1f2937]" />
                <span className="text-[11px] font-medium text-primary uppercase tracking-wider">
                  Fonctionnalités Business
                </span>
                <div className="h-px flex-1 bg-[#1f2937]" />
              </div>
              {businessSections.map((section) => (
                <SectionCard key={section.name} section={section} />
              ))}
            </>
          )}

          {!isBusiness && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 mt-4">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-primary shrink-0" />
                <div>
                  <h3 className="text-[13px] font-semibold text-white">Fonctionnalités Business</h3>
                  <p className="text-[11px] text-[#8b9cb3] mt-0.5">
                    Passez au plan Business pour débloquer la gestion d'équipe, les boîtes partagées et le suivi d'activité.
                  </p>
                </div>
                <Link href="/dashboard/abonnement">
                  <button className="shrink-0 text-[11px] font-medium text-primary hover:text-white transition-colors">
                    Voir les plans →
                  </button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
