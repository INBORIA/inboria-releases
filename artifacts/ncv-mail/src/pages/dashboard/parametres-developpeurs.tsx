import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useEnableLightTheme } from "@/lib/inbox-theme";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Code2, Key, Webhook, Clock, ChevronRight, ArrowLeft } from "lucide-react";

interface DevCard {
  href: string;
  icon: any;
  titleKey: string;
  titleFallback: string;
  descKey: string;
  descFallback: string;
  testId: string;
}

export default function ParametresDeveloppeurs() {
  useEnableLightTheme();
  const { t } = useTranslation();

  const cards: DevCard[] = [
    {
      href: "/dashboard/parametres/api",
      icon: Key,
      titleKey: "settings.apiCard",
      titleFallback: "API publique",
      descKey: "settings.apiCardDesc",
      descFallback: "Clés API & documentation",
      testId: "dev-card-api",
    },
    {
      href: "/dashboard/parametres/webhooks",
      icon: Webhook,
      titleKey: "settings.webhooksCard",
      titleFallback: "Webhooks",
      descKey: "settings.webhooksCardDesc",
      descFallback: "Notifications HTTP signées",
      testId: "dev-card-webhooks",
    },
    {
      href: "/dashboard/parametres/sla",
      icon: Clock,
      titleKey: "settings.slaCard",
      titleFallback: "SLA boîtes partagées",
      descKey: "settings.slaCardDesc",
      descFallback: "Délais de réponse, alertes",
      testId: "dev-card-sla",
    },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4">
        <div>
          <Link href="/dashboard/parametres">
            <Button variant="ghost" size="sm" className="h-7 px-2 text-[#b8c5d6] hover:text-white">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> {t("settings.title")}
            </Button>
          </Link>
        </div>
        <div>
          <h1 className="text-[16px] font-semibold text-white tracking-tight flex items-center gap-2">
            <Code2 className="w-4 h-4 text-primary" />
            {t("settings.hub.developers", "Pour développeurs")}
          </h1>
          <p className="text-[12px] text-[#b8c5d6] mt-0.5">
            {t("settings.hub.developersDesc", "API, Webhooks, SLA")}
          </p>
        </div>

        <div className="space-y-2">
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
