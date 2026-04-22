import { useGetProfile } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Link, useLocation } from "wouter";
import {
  Inbox,
  LayoutDashboard,
  CheckSquare,
  Tags,
  Settings,
  CreditCard,
  LogOut,
  Loader2,
  Menu,
  Archive,
  FolderKanban,
  AlertTriangle,
  Users,
  MailPlus,
  Activity,
  BookOpen,
  Send,
  CalendarDays,
  ShieldCheck,
} from "lucide-react";
import appLogo from "@assets/inboria_logo_transparent_fix_v1_1775916067670.png";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { SupportChatWidget } from "@/components/SupportChatWidget";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [location, setLocation] = useLocation();
  const { signOut } = useAuth();
  const { data: profile, isLoading } = useGetProfile({
    query: { refetchInterval: 30000, refetchIntervalInBackground: false } as any,
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const user = profile || { fullName: "", plan: "essai", emailsUsed: 0, aiCreditsUsed: 0, emailsQuota: 100 };
  const totalUsed = ((user as any).emailsUsed || 0) + ((user as any).aiCreditsUsed || 0);

  const baseNavigation = [
    { name: t("sidebar.inbox"), href: "/dashboard", icon: Inbox },
    { name: t("sidebar.sent"), href: "/dashboard/envoyes", icon: Send },
    { name: t("tasks.title"), href: "/dashboard/taches", icon: CheckSquare },
    { name: t("sidebar.projects"), href: "/dashboard/projets", icon: FolderKanban },
    { name: t("sidebar.agenda"), href: "/dashboard/agenda", icon: CalendarDays },
    { name: t("sidebar.archives"), href: "/dashboard/archives", icon: Archive },
    { name: t("sidebar.dailyBrief"), href: "/dashboard/bilan", icon: LayoutDashboard },
    { name: t("sidebar.classification"), href: "/dashboard/classement", icon: Tags },
    { name: t("sidebar.settings"), href: "/dashboard/parametres", icon: Settings },
    { name: t("sidebar.subscription"), href: "/dashboard/abonnement", icon: CreditCard },
    { name: t("sidebar.manual"), href: "/dashboard/manuel", icon: BookOpen },
  ];

  const isBusiness = (user as any).plan === "business";
  const isInternalAdmin = !!(user as any).isAdmin;
  const archivesIndex = 5;
  let navigation = isBusiness
    ? [
        ...baseNavigation.slice(0, archivesIndex + 1),
        { name: t("sidebar.sharedMailboxes"), href: "/dashboard/boites-partagees", icon: MailPlus },
        { name: t("sidebar.myTeam"), href: "/dashboard/equipe", icon: Users },
        { name: t("sidebar.teamActivity"), href: "/dashboard/activite-equipe", icon: Activity },
        ...baseNavigation.slice(archivesIndex + 1),
      ]
    : baseNavigation;

  if (isInternalAdmin) {
    navigation = [
      ...navigation,
      { name: t("sidebar.admin"), href: "/dashboard/admin", icon: ShieldCheck },
    ];
  }

  const isExpired = (user as any).plan === "expired";
  const isTrialExhausted = (user as any).plan === "essai" && totalUsed >= (user as any).emailsQuota;
  const isBlocked = isExpired || isTrialExhausted;

  const allowedWhenBlocked = ["/dashboard/abonnement", "/dashboard/parametres", "/dashboard/manuel"];
  const isAdminRoute = location.startsWith("/dashboard/admin");

  useEffect(() => {
    if (
      !isLoading &&
      isBlocked &&
      !allowedWhenBlocked.includes(location) &&
      !(isInternalAdmin && isAdminRoute)
    ) {
      setLocation("/dashboard/abonnement");
    }
  }, [isBlocked, isLoading, location, setLocation, isInternalAdmin, isAdminRoute]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleLogout = async () => {
    await signOut();
    setLocation("/login");
  };

  const usagePercent = Math.min(
    100,
    (totalUsed / Math.max(1, (user as any).emailsQuota)) * 100
  );

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      <div className="flex h-32 shrink-0 flex-col items-center justify-center px-4 border-b border-[#1f2937]">
        <img src={appLogo} alt="Inboria" className="h-32 w-auto object-contain" />
      </div>
      
      <nav className="flex-1 px-2 py-2.5 space-y-0.5">
        {navigation.map((item) => {
          const isActive = location === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                isActive
                  ? "bg-[#1e3a5f] text-primary"
                  : "text-[#8b9cb3] hover:text-white hover:bg-white/[0.04]",
                "group flex items-center gap-x-2.5 rounded-md px-2.5 py-[7px] text-[12px] font-medium transition-colors"
              )}
              onClick={() => setMobileMenuOpen(false)}
            >
              <item.icon
                className={cn(
                  isActive ? "text-primary" : "text-[#8b9cb3] group-hover:text-white",
                  "h-4 w-4 shrink-0 transition-colors"
                )}
                aria-hidden="true"
              />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-2.5 mt-auto border-t border-[#1f2937]">
        <div className="px-2.5 py-2 mb-2">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] font-medium text-[#8b9cb3] uppercase tracking-wider">
              {t("sidebar.aiCredits")}
            </span>
            <span className="text-[10px] font-medium text-white">
              {totalUsed}/{(user as any).emailsQuota}
            </span>
          </div>
          <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                usagePercent >= 90 ? "bg-red-500" : usagePercent >= 80 ? "bg-amber-500" : "bg-primary"
              )}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
          <div className="mt-1 text-[9px] text-[#6b7d96] flex justify-between">
            <span>{t("sidebar.creditsBreakdownMails", { count: (user as any).emailsUsed || 0 })}</span>
            <span>{t("sidebar.creditsBreakdownAi", { count: (user as any).aiCreditsUsed || 0 })}</span>
          </div>
        </div>

        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-[#1e3a5f] flex items-center justify-center text-[11px] font-semibold text-primary">
              {((user as any).fullName || t("sidebar.user")).charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col">
              <span className="text-[12px] font-medium text-white truncate max-w-[100px]">
                {(user as any).fullName || t("sidebar.user")}
              </span>
              <span className="text-[10px] text-[#8b9cb3] capitalize">
                {(user as any).plan}
              </span>
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-[#8b9cb3] hover:text-white hover:bg-white/[0.06] h-7 w-7"
                onClick={handleLogout}
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>{t("nav.logout")}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-[200px] lg:flex-col">
        <div className="flex grow flex-col overflow-y-auto bg-sidebar border-r border-[#1f2937]">
          <SidebarContent />
        </div>
      </div>

      <div className="lg:pl-[200px] flex flex-col flex-1 min-w-0">
        <div className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-x-4 border-b border-border bg-background px-4">
          <div className="lg:hidden flex items-center">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-white h-8 w-8">
                  <span className="sr-only">{t("nav.openMenu")}</span>
                  <Menu className="h-5 w-5" aria-hidden="true" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 bg-sidebar w-[200px] border-r border-[#1f2937]">
                <SidebarContent />
              </SheetContent>
            </Sheet>
            <div className="flex items-center gap-2 ml-2">
              <img src={appLogo} alt="Inboria" className="h-32 w-auto object-contain" />
            </div>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
          </div>
        </div>

        <main className="flex-1">
          {isBlocked && location !== "/dashboard/abonnement" && (
            <div className="bg-red-500/10 border-b border-red-500/20 px-5 py-3">
              <div className="flex items-center gap-3 max-w-4xl mx-auto">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-[12px] font-medium text-red-400">
                    {isExpired
                      ? t("dashboard.expiredSubscription")
                      : t("dashboard.trialEnded")}
                  </p>
                  <p className="text-[11px] text-[#8b9cb3] mt-0.5">
                    {isExpired
                      ? t("dashboard.resubscribe")
                      : t("dashboard.trialUsed")}
                  </p>
                </div>
                <Link href="/dashboard/abonnement">
                  <Button size="sm" className="shrink-0 h-7 text-[12px]">
                    {t("dashboard.choosePlan")}
                  </Button>
                </Link>
              </div>
            </div>
          )}
          {children}
        </main>
      </div>
      <SupportChatWidget />
    </div>
  );
}
