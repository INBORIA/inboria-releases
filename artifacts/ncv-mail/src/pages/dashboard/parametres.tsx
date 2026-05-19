import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useEnableLightTheme } from "@/lib/inbox-theme";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { User, Building2, Code2, Users, ChevronRight, ArrowLeft, ShieldCheck, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGetProfile, useGetMyOrganisation } from "@workspace/api-client-react";

interface HubCard {
  href: string;
  icon: any;
  titleKey: string;
  titleFallback: string;
  descKey: string;
  descFallback: string;
  testId: string;
}

export default function Parametres() {
  useEnableLightTheme();
  const { t } = useTranslation();
  const { data: profile } = useGetProfile();
  const isBusiness = (profile as any)?.plan === "business";
  const { data: myOrg } = useGetMyOrganisation();
  const isOrgAdmin = (myOrg as any)?.myRole === "admin";

  const cards: HubCard[] = [
    {
      href: "/dashboard/parametres/mon-compte",
      icon: User,
      titleKey: "settings.hub.myAccount",
      titleFallback: "Mon compte",
      descKey: "settings.hub.myAccountDesc",
      descFallback: "Profil, sécurité, comptes email, Inboria et notifications",
      testId: "hub-card-mon-compte",
    },
    ...(isOrgAdmin
      ? [
          {
            href: "/dashboard/parametres/administration",
            icon: ShieldCheck,
            titleKey: "settings.hub.administration",
            titleFallback: "Administration",
            descKey: "settings.hub.administrationDesc",
            descFallback:
              "Équipe, boîtes partagées, SLA, règles, audit — réglages admin",
            testId: "hub-card-administration",
          },
        ]
      : []),
    ...(isBusiness && isOrgAdmin
      ? [
          {
            href: "/dashboard/equipe",
            icon: Users,
            titleKey: "settings.hub.myTeam",
            titleFallback: "Mon équipe",
            descKey: "settings.hub.myTeamDesc",
            descFallback: "Inviter et gérer les membres de votre équipe",
            testId: "hub-card-mon-equipe",
          },
        ]
      : []),
    {
      href: "/dashboard/parametres/calendriers",
      icon: CalendarIcon,
      titleKey: "settings.hub.calendars",
      titleFallback: "Calendriers",
      descKey: "settings.hub.calendarsDesc",
      descFallback: "Connecter Google Calendar et Outlook Calendar",
      testId: "hub-card-calendriers",
    },
    {
      href: "/dashboard/parametres/vie-privee",
      icon: ShieldCheck,
      titleKey: "settings.hub.privacy",
      titleFallback: "Vie privée et accès équipe",
      descKey: "settings.hub.privacyDesc",
      descFallback: "Vos emails privés et le journal des consultations admin",
      testId: "hub-card-vie-privee",
    },
    {
      href: "/dashboard/parametres/crm",
      icon: Building2,
      titleKey: "settings.hub.crm",
      titleFallback: "CRM",
      descKey: "settings.hub.crmDesc",
      descFallback: "HubSpot, Pipedrive, Salesforce, Odoo",
      testId: "hub-card-crm",
    },
    ...(isOrgAdmin
      ? [
          {
            href: "/dashboard/parametres/developpeurs",
            icon: Code2,
            titleKey: "settings.hub.developers",
            titleFallback: "Pour développeurs",
            descKey: "settings.hub.developersDesc",
            descFallback: "API, Webhooks, SLA",
            testId: "hub-card-developers",
          },
        ]
      : []),
  ];

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5">
        <div className="mb-2">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="h-7 px-2 text-[#b8c5d6] hover:text-white" data-testid="back-to-inbox">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> {t("sidebar.inbox", "Boîte de réception")}
            </Button>
          </Link>
        </div>
        <div className="mb-6">
          <h1 className="text-[16px] font-semibold text-white tracking-tight">{t("settings.title")}</h1>
          <p className="text-[12px] text-[#b8c5d6] mt-0.5">{t("settings.subtitle")}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <Link
                key={c.href}
                href={c.href}
                data-testid={c.testId}
                className="group bg-card border border-border rounded-lg p-4 hover:border-primary/40 transition-colors flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-white">{t(c.titleKey, c.titleFallback)}</div>
                  <div className="text-[11px] text-[#b8c5d6] mt-0.5">{t(c.descKey, c.descFallback)}</div>
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
