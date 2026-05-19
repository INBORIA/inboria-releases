import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useEnableLightTheme } from "@/lib/inbox-theme";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  Users,
  Inbox,
  Clock,
  Tag,
  BarChart3,
  Trophy,
  ChevronRight,
  ArrowLeft,
  Lock,
} from "lucide-react";

interface AdminCard {
  href: string;
  icon: any;
  titleKey: string;
  titleFallback: string;
  descKey: string;
  descFallback: string;
  testId: string;
}

export default function ParametresAdministration() {
  useEnableLightTheme();
  const { t } = useTranslation();

  const withFrom = (href: string) => (href.includes("?") ? `${href}&from=admin` : `${href}?from=admin`);

  const cards: AdminCard[] = [
    {
      href: "/dashboard/equipe",
      icon: Users,
      titleKey: "settings.admin.team",
      titleFallback: "Équipe & membres",
      descKey: "settings.admin.teamDesc",
      descFallback: "Inviter, attribuer des rôles, retirer des membres",
      testId: "admin-card-team",
    },
    {
      href: "/dashboard/parametres/mon-compte#shared-mailboxes",
      icon: Inbox,
      titleKey: "settings.admin.sharedMailboxes",
      titleFallback: "Boîtes partagées",
      descKey: "settings.admin.sharedMailboxesDesc",
      descFallback: "Partager des boîtes mail avec l'équipe (support@, contact@…)",
      testId: "admin-card-shared-mailboxes",
    },
    {
      href: "/dashboard/parametres/sla",
      icon: Clock,
      titleKey: "settings.admin.sla",
      titleFallback: "SLA boîtes partagées",
      descKey: "settings.admin.slaDesc",
      descFallback: "Délais de réponse cibles, heures ouvrées, alertes",
      testId: "admin-card-sla",
    },
    {
      href: "/dashboard/parametres/regles",
      icon: Tag,
      titleKey: "settings.admin.rules",
      titleFallback: "Règles & catégories",
      descKey: "settings.admin.rulesDesc",
      descFallback: "Règles d'automatisation et catégories partagées",
      testId: "admin-card-rules",
    },
    {
      href: "/dashboard/parametres/vie-privee",
      icon: Lock,
      titleKey: "settings.admin.privacy",
      titleFallback: "Vie privée & audit",
      descKey: "settings.admin.privacyDesc",
      descFallback: "Journal des accès admin aux dossiers équipe",
      testId: "admin-card-privacy",
    },
    {
      href: "/dashboard/bilan",
      icon: BarChart3,
      titleKey: "settings.admin.bilan",
      titleFallback: "Bilan équipe",
      descKey: "settings.admin.bilanDesc",
      descFallback: "Statistiques agrégées et performances de l'équipe",
      testId: "admin-card-bilan",
    },
    {
      href: "/dashboard/classement",
      icon: Trophy,
      titleKey: "settings.admin.classement",
      titleFallback: "Classement & dédoublonnage",
      descKey: "settings.admin.classementDesc",
      descFallback: "Classement contacts et fusion des doublons de l'org",
      testId: "admin-card-classement",
    },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4">
        <div>
          <Link href="/dashboard/parametres">
            <Button variant="ghost" size="sm" className="h-7 px-2 text-[#b8c5d6] hover:text-white" data-testid="back-to-settings">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> {t("settings.title")}
            </Button>
          </Link>
        </div>
        <div>
          <h1 className="text-[16px] font-semibold text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            {t("settings.hub.administration", "Administration")}
          </h1>
          <p className="text-[12px] text-[#b8c5d6] mt-0.5">
            {t(
              "settings.hub.administrationDesc",
              "Réglages réservés aux administrateurs de l'organisation"
            )}
          </p>
        </div>

        <div className="space-y-2">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <Link
                key={c.href}
                href={withFrom(c.href)}
                data-testid={c.testId}
                className="group bg-card border border-border rounded-lg p-4 hover:border-primary/40 transition-colors flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-white">
                    {t(c.titleKey, c.titleFallback)}
                  </div>
                  <div className="text-[11px] text-[#b8c5d6] mt-0.5">
                    {t(c.descKey, c.descFallback)}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#b8c5d6] group-hover:text-white transition-colors shrink-0" />
              </Link>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
