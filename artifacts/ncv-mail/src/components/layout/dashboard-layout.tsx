import {
  useGetProfile,
  useGetMyOrganisation,
  useGetOrganisationMembers,
} from "@workspace/api-client-react";
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
  Activity,
  Send,
  CalendarClock,
  CalendarDays,
  BellOff,
  ShieldCheck,
  MailCheck,
  FileText,
  Wand2,
  Users,
} from "lucide-react";
import appLogo from "@assets/inboria_logo_transparent_fix_v1_1775916067670.png";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { SupportChatWidget } from "@/components/SupportChatWidget";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { AutopilotIndicator } from "@/components/autopilot/autopilot-indicator";
import { InboriaChatButton } from "@/components/inboria-chat/InboriaChatButton";

export function DashboardLayout({ children, rightSidebar }: { children: React.ReactNode; rightSidebar?: React.ReactNode }) {
  const { t } = useTranslation();
  const [location, setLocation] = useLocation();
  const { signOut } = useAuth();
  const { data: profile, isLoading } = useGetProfile({
    query: { refetchInterval: 30000, refetchIntervalInBackground: false } as any,
  });
  const { data: myOrg } = useGetMyOrganisation();
  const orgId = (myOrg as { id?: string } | undefined)?.id;
  const myRole = (myOrg as { myRole?: string } | undefined)?.myRole;
  const isOrgMember = !!orgId && myRole !== "admin";
  const { data: orgMembersData } = useGetOrganisationMembers({
    query: { enabled: !!orgId } as any,
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const user = profile || { fullName: "", plan: "essai", emailsUsed: 0, aiCreditsUsed: 0, emailsQuota: 100 };
  const totalUsed = ((user as any).emailsUsed || 0) + ((user as any).aiCreditsUsed || 0);
  // Considère « équipe » uniquement s'il existe au moins un coéquipier actif
  // en plus du compte courant — un solo avec organisation seule n'a pas
  // besoin de la vue activité équipe.
  const activeMembersCount = Array.isArray(orgMembersData)
    ? (orgMembersData as Array<{ status?: string }>).filter(
        (m) => m.status === "active",
      ).length
    : 0;
  const hasTeam = !!orgId && activeMembersCount > 1;

  const baseNavigation: Array<{ name: string; href: string; icon: any }> = [
    { name: t("sidebar.inbox"), href: "/dashboard", icon: Inbox },
    { name: t("sidebar.sent"), href: "/dashboard/envoyes", icon: Send },
    ...(hasTeam
      ? [{ name: t("sidebar.teamActivity"), href: "/dashboard/activite-equipe", icon: Activity }]
      : []),
    { name: t("sidebar.snoozed", "Reportés"), href: "/dashboard/reportes", icon: BellOff },
    { name: t("sidebar.scheduled", "Programmés"), href: "/dashboard/programmes", icon: CalendarClock },
    { name: t("tasks.title"), href: "/dashboard/taches", icon: CheckSquare },
    { name: t("sidebar.followups", "Relances"), href: "/dashboard/relances", icon: MailCheck },
    { name: t("sidebar.projects"), href: "/dashboard/projets", icon: FolderKanban },
    { name: t("sidebar.contacts", "Contacts"), href: "/dashboard/contacts", icon: Users },
    { name: t("sidebar.agenda"), href: "/dashboard/agenda", icon: CalendarDays },
    { name: t("sidebar.archives"), href: "/dashboard/archives", icon: Archive },
    { name: t("sidebar.dailyBrief"), href: "/dashboard/bilan", icon: LayoutDashboard },
    { name: t("sidebar.classification"), href: "/dashboard/classement", icon: Tags },
    { name: t("templates.title"), href: "/dashboard/parametres/templates", icon: FileText },
    { name: t("rules.title"), href: "/dashboard/parametres/regles", icon: Wand2 },
  ];

  const isInternalAdmin = !!(user as any).isAdmin;
  let navigation = baseNavigation;

  if (isInternalAdmin) {
    navigation = [
      ...navigation,
      { name: t("sidebar.admin"), href: "/dashboard/admin", icon: ShieldCheck },
    ];
  }

  const isExpired = (user as any).plan === "expired";
  const isTrialExhausted = (user as any).plan === "essai" && totalUsed >= (user as any).emailsQuota;
  const isBlocked = isExpired || isTrialExhausted;

  const isAdminRoute = location.startsWith("/dashboard/admin");
  const isAllowedWhenBlocked =
    location === "/dashboard/abonnement" ||
    location === "/dashboard/parametres" ||
    location.startsWith("/dashboard/parametres/");

  useEffect(() => {
    if (
      !isLoading &&
      isBlocked &&
      !isAllowedWhenBlocked &&
      !(isInternalAdmin && isAdminRoute)
    ) {
      // Members can't fix billing — bounce them to "Mon compte" instead of
      // /abonnement (which they can't access) to avoid a redirect loop.
      setLocation(isOrgMember ? "/dashboard/parametres/mon-compte" : "/dashboard/abonnement");
    }
  }, [isBlocked, isLoading, location, setLocation, isInternalAdmin, isAdminRoute, isAllowedWhenBlocked, isOrgMember]);

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

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      <div className="flex h-28 shrink-0 flex-col items-center justify-center px-4 border-b border-[#1f2937]">
        <img src={appLogo} alt="Inboria" className="h-24 w-auto object-contain" />
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
                  : "text-[#b8c5d6] hover:text-white hover:bg-white/[0.04]",
                "group flex items-center gap-x-2.5 rounded-md px-2.5 py-[7px] text-[13px] font-medium transition-colors"
              )}
              onClick={() => {
                setMobileMenuOpen(false);
                if (location === item.href) {
                  window.dispatchEvent(
                    new CustomEvent("sidebar-nav-reset", { detail: { href: item.href } })
                  );
                }
              }}
            >
              <item.icon
                className={cn(
                  isActive ? "text-primary" : "text-[#b8c5d6] group-hover:text-white",
                  "h-4 w-4 shrink-0 transition-colors"
                )}
                aria-hidden="true"
              />
              <span className="flex-1 truncate">{item.name}</span>
            </Link>
          );
        })}
      </nav>

    </div>
  );

  const UserMenu = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center justify-center h-8 w-8 rounded-full hover:ring-2 hover:ring-primary/40 transition-all"
          data-testid="user-menu-trigger"
          aria-label={t("sidebar.user")}
        >
          <div className="h-8 w-8 rounded-full bg-[#1e3a5f] flex items-center justify-center text-[12px] font-semibold text-primary shrink-0">
            {((user as any).fullName || t("sidebar.user")).charAt(0).toUpperCase()}
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="end" className="w-56 mt-1">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col">
            <span className="text-[13px] font-medium text-white truncate">
              {(user as any).fullName || t("sidebar.user")}
            </span>
            <span className="text-[11px] text-[#b8c5d6] capitalize">
              {(user as any).plan}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isOrgMember ? (
          <DropdownMenuItem asChild data-testid="user-menu-my-account">
            <Link href="/dashboard/parametres/mon-compte" className="cursor-pointer">
              <Settings className="h-4 w-4 mr-2" />
              {t("settings.hub.myAccount", "Mon compte")}
            </Link>
          </DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuItem asChild data-testid="user-menu-subscription">
              <Link href="/dashboard/abonnement" className="cursor-pointer">
                <CreditCard className="h-4 w-4 mr-2" />
                {t("sidebar.subscription")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild data-testid="user-menu-settings">
              <Link href="/dashboard/parametres" className="cursor-pointer">
                <Settings className="h-4 w-4 mr-2" />
                {t("sidebar.settings")}
              </Link>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          className="cursor-pointer text-red-400 focus:text-red-300 focus:bg-red-500/10"
          data-testid="user-menu-logout"
        >
          <LogOut className="h-4 w-4 mr-2" />
          {t("nav.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="min-h-screen bg-background flex">
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-[200px] lg:flex-col">
        <div className="flex grow flex-col overflow-y-auto bg-sidebar border-r border-[#1f2937]">
          <SidebarContent />
        </div>
      </div>

      {/* Sidebar droite optionnelle (ex. panneau Categories de l'inbox) :
          positionnee en fixed top-28 (sous le bandeau logo) pour aligner
          son haut au pixel pres avec le premier item de la sidebar
          gauche (« Reception »). Look 3 colonnes type Outlook/Linear. */}
      {rightSidebar && (
        <aside className="hidden lg:flex lg:fixed lg:top-28 lg:bottom-0 lg:right-0 lg:w-[260px] flex-col overflow-y-auto bg-sidebar border-l border-[#1f2937] p-4">
          {rightSidebar}
        </aside>
      )}

      <div className={cn("lg:pl-[200px] flex flex-col flex-1 min-w-0", rightSidebar && "lg:pr-[260px]")}>
        <div className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-x-4 border-b border-border bg-background px-4">
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
              <img src={appLogo} alt="Inboria" className="h-14 w-auto object-contain" />
            </div>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <InboriaChatButton />
            <AutopilotIndicator />
            <NotificationBell />
            <LanguageSwitcher />
            <UserMenu />
          </div>
        </div>

        <main className="flex-1">
          {isBlocked && location !== "/dashboard/abonnement" && (
            isOrgMember ? (
              <div className="bg-amber-500/10 border-b border-amber-500/20 px-5 py-3">
                <div className="flex items-center gap-3 max-w-4xl mx-auto">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <div className="flex-1">
                    <p className="text-[13px] font-medium text-amber-400">
                      {t("dashboard.contactAdminTitle", "Souci d'abonnement côté équipe")}
                    </p>
                    <p className="text-[12px] text-[#b8c5d6] mt-0.5">
                      {t("dashboard.contactAdminDesc", "Contactez l'admin de votre équipe pour régler ça.")}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-red-500/10 border-b border-red-500/20 px-5 py-3">
                <div className="flex items-center gap-3 max-w-4xl mx-auto">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <div className="flex-1">
                    <p className="text-[13px] font-medium text-red-400">
                      {isExpired
                        ? t("dashboard.expiredSubscription")
                        : t("dashboard.trialEnded")}
                    </p>
                    <p className="text-[12px] text-[#b8c5d6] mt-0.5">
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
            )
          )}
          {children}
        </main>
      </div>
      <SupportChatWidget />
    </div>
  );
}
