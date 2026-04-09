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
import { useTranslation } from "react-i18next";
import type { LucideIcon } from "lucide-react";

interface ManualSection {
  icon: LucideIcon;
  nameKey: string;
  descKey: string;
  featuresKey: string;
  href: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

const sectionConfigs: ManualSection[] = [
  {
    icon: Inbox,
    nameKey: "manual.sections.reception",
    descKey: "manual.sections.receptionDesc",
    featuresKey: "manual.sections.receptionFeatures",
    href: "/dashboard",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
  },
  {
    icon: Paperclip,
    nameKey: "manual.sections.attachments",
    descKey: "manual.sections.attachmentsDesc",
    featuresKey: "manual.sections.attachmentsFeatures",
    href: "/dashboard",
    color: "text-sky-400",
    bgColor: "bg-sky-500/10",
    borderColor: "border-sky-500/20",
  },
  {
    icon: Send,
    nameKey: "manual.sections.sent",
    descKey: "manual.sections.sentDesc",
    featuresKey: "manual.sections.sentFeatures",
    href: "/dashboard/envoyes",
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/20",
  },
  {
    icon: Archive,
    nameKey: "manual.sections.archives",
    descKey: "manual.sections.archivesDesc",
    featuresKey: "manual.sections.archivesFeatures",
    href: "/dashboard/archives",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
  },
  {
    icon: LayoutDashboard,
    nameKey: "manual.sections.brief",
    descKey: "manual.sections.briefDesc",
    featuresKey: "manual.sections.briefFeatures",
    href: "/dashboard/bilan",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
  },
  {
    icon: CheckSquare,
    nameKey: "manual.sections.tasks",
    descKey: "manual.sections.tasksDesc",
    featuresKey: "manual.sections.tasksFeatures",
    href: "/dashboard/taches",
    color: "text-violet-400",
    bgColor: "bg-violet-500/10",
    borderColor: "border-violet-500/20",
  },
  {
    icon: FolderKanban,
    nameKey: "manual.sections.projects",
    descKey: "manual.sections.projectsDesc",
    featuresKey: "manual.sections.projectsFeatures",
    href: "/dashboard/projets",
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/20",
  },
  {
    icon: Tags,
    nameKey: "manual.sections.classification",
    descKey: "manual.sections.classificationDesc",
    featuresKey: "manual.sections.classificationFeatures",
    href: "/dashboard/classement",
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/20",
  },
  {
    icon: Bell,
    nameKey: "manual.sections.notifications",
    descKey: "manual.sections.notificationsDesc",
    featuresKey: "manual.sections.notificationsFeatures",
    href: "/dashboard",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/20",
  },
  {
    icon: Settings,
    nameKey: "manual.sections.settings",
    descKey: "manual.sections.settingsDesc",
    featuresKey: "manual.sections.settingsFeatures",
    href: "/dashboard/parametres",
    color: "text-gray-400",
    bgColor: "bg-gray-500/10",
    borderColor: "border-gray-500/20",
  },
  {
    icon: CreditCard,
    nameKey: "manual.sections.subscription",
    descKey: "manual.sections.subscriptionDesc",
    featuresKey: "manual.sections.subscriptionFeatures",
    href: "/dashboard/abonnement",
    color: "text-pink-400",
    bgColor: "bg-pink-500/10",
    borderColor: "border-pink-500/20",
  },
];

const businessSectionConfigs: ManualSection[] = [
  {
    icon: Users,
    nameKey: "manual.sections.team",
    descKey: "manual.sections.teamDesc",
    featuresKey: "manual.sections.teamFeatures",
    href: "/dashboard/equipe",
    color: "text-indigo-400",
    bgColor: "bg-indigo-500/10",
    borderColor: "border-indigo-500/20",
  },
  {
    icon: MailPlus,
    nameKey: "manual.sections.sharedMailboxes",
    descKey: "manual.sections.sharedMailboxesDesc",
    featuresKey: "manual.sections.sharedMailboxesFeatures",
    href: "/dashboard/boites-partagees",
    color: "text-teal-400",
    bgColor: "bg-teal-500/10",
    borderColor: "border-teal-500/20",
  },
  {
    icon: Activity,
    nameKey: "manual.sections.teamActivity",
    descKey: "manual.sections.teamActivityDesc",
    featuresKey: "manual.sections.teamActivityFeatures",
    href: "/dashboard/activite-equipe",
    color: "text-rose-400",
    bgColor: "bg-rose-500/10",
    borderColor: "border-rose-500/20",
  },
];

function SectionCard({ section }: { section: ManualSection }) {
  const { t } = useTranslation();
  const Icon = section.icon;
  const features = t(section.featuresKey, { returnObjects: true }) as string[];
  return (
    <div className={`rounded-xl border ${section.borderColor} ${section.bgColor} p-5 transition-all hover:shadow-lg hover:shadow-black/20`}>
      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 rounded-lg ${section.bgColor} border ${section.borderColor} flex items-center justify-center shrink-0`}>
          <Icon className={`w-5 h-5 ${section.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[15px] font-semibold text-white">{t(section.nameKey)}</h3>
            <Link
              href={section.href}
              className={`flex items-center gap-1 text-[11px] ${section.color} hover:text-white transition-colors`}
            >
              {t("manual.open")}
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <p className="text-[12px] text-[#8b9cb3] leading-relaxed mb-3">
            {t(section.descKey)}
          </p>
          <ul className="space-y-1.5">
            {Array.isArray(features) && features.map((feature, i) => (
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
  const { t } = useTranslation();
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
              <h1 className="text-[18px] font-bold text-white">{t("manual.title")}</h1>
              <p className="text-[12px] text-[#8b9cb3]">
                {t("manual.subtitle")}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {sectionConfigs.map((section) => (
            <SectionCard key={section.nameKey} section={section} />
          ))}

          {isBusiness && (
            <>
              <div className="flex items-center gap-3 mt-8 mb-2">
                <div className="h-px flex-1 bg-[#1f2937]" />
                <span className="text-[11px] font-medium text-primary uppercase tracking-wider">
                  {t("manual.businessFeatures")}
                </span>
                <div className="h-px flex-1 bg-[#1f2937]" />
              </div>
              {businessSectionConfigs.map((section) => (
                <SectionCard key={section.nameKey} section={section} />
              ))}
            </>
          )}

          {!isBusiness && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 mt-4">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-primary shrink-0" />
                <div>
                  <h3 className="text-[13px] font-semibold text-white">{t("manual.businessUpgradeTitle")}</h3>
                  <p className="text-[11px] text-[#8b9cb3] mt-0.5">
                    {t("manual.businessUpgradeDesc")}
                  </p>
                </div>
                <Link href="/dashboard/abonnement">
                  <button className="shrink-0 text-[11px] font-medium text-primary hover:text-white transition-colors">
                    {t("manual.viewPlans")}
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
