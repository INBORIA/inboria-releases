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
} from "lucide-react";
import mailopsLogo from "@assets/mailops_logo_white_transparent_v1_1775861214478.png";
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
  const { data: profile, isLoading } = useGetProfile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const user = profile || { fullName: "", plan: "essai", emailsUsed: 0, emailsQuota: 100 };

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
  const archivesIndex = 5;
  const navigation = isBusiness
    ? [
        ...baseNavigation.slice(0, archivesIndex + 1),
        { name: t("sidebar.sharedMailboxes"), href: "/dashboard/boites-partagees", icon: MailPlus },
        { name: t("sidebar.myTeam"), href: "/dashboard/equipe", icon: Users },
        { name: t("sidebar.teamActivity"), href: "/dashboard/activite-equipe", icon: Activity },
        ...baseNavigation.slice(archivesIndex + 1),
      ]
    : baseNavigation;

  const isExpired = (user as any).plan === "expired";
  const isTrialExhausted = (user as any).plan === "essai" && (user as any).emailsUsed >= (user as any).emailsQuota;
  const isBlocked = isExpired || isTrialExhausted;

  const allowedWhenBlocked = ["/dashboard/abonnement", "/dashboard/parametres", "/dashboard/manuel"];

  useEffect(() => {
    if (!isLoading && isBlocked && !allowedWhenBlocked.includes(location)) {
      setLocation("/dashboard/abonnement");
    }
  }, [isBlocked, isLoading, location, setLocation]);

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
    ((user as any).emailsUsed / Math.max(1, (user as any).emailsQuota)) * 100
  );

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      <div className="flex h-36 shrink-0 flex-col items-center justify-center px-4 border-b border-[#1f2937]">
        <img src={mailopsLogo} alt="MailOps" className="h-24 w-24 object-contain" />
        <span className="text-sm font-semibold tracking-tight text-white -mt-1">MailOps</span>
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
              {t("sidebar.emailQuota")}
            </span>
            <span className="text-[10px] font-medium text-white">
              {(user as any).emailsUsed}/{(user as any).emailsQuota}
            </span>
          </div>
          <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${usagePercent}%` }}
            />
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
              <img src={mailopsLogo} alt="MailOps" className="h-16 w-16 object-contain" />
              <span className="font-semibold text-[15px] text-white">MailOps</span>
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
