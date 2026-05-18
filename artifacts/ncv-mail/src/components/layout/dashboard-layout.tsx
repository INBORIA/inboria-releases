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
  FolderOpen,
  AlertTriangle,
  Activity,
  Send,
  CalendarClock,
  CalendarDays,
  BellOff,
  ShieldCheck,
  FileText,
  Wand2,
  Users,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import appLogo from "@assets/inboria_logo_transparent_fix_v1_1775916067670.png";
import { cn } from "@/lib/utils";
import { useNcvTheme } from "@/lib/inbox-theme";
import { useState, useEffect, useRef } from "react";
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
import { useMailHeaderCollapsed } from "@/lib/use-mail-header-collapsed";

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
  const [open, setOpen] = useState(false);
  const userMenuWrapRef = useRef<HTMLDivElement>(null);

  // ─── Sidebar resizable + collapsible ───────────────────────────────────
  const SIDEBAR_DEFAULT = 200;
  const SIDEBAR_MIN = 160;
  const SIDEBAR_MAX = 380;
  const SIDEBAR_COLLAPSED_W = 56;
  const LS_SIDEBAR_W = "inboria.sidebar.width";
  const LS_SIDEBAR_COLLAPSED = "inboria.sidebar.collapsed";
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    if (typeof window === "undefined") return SIDEBAR_DEFAULT;
    const raw = window.localStorage.getItem(LS_SIDEBAR_W);
    const n = raw ? parseInt(raw, 10) : SIDEBAR_DEFAULT;
    if (Number.isNaN(n)) return SIDEBAR_DEFAULT;
    return Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, n));
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(LS_SIDEBAR_COLLAPSED) === "1";
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LS_SIDEBAR_W, String(sidebarWidth));
    }
  }, [sidebarWidth]);
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        LS_SIDEBAR_COLLAPSED,
        sidebarCollapsed ? "1" : "0",
      );
    }
  }, [sidebarCollapsed]);
  const effectiveSidebarW = sidebarCollapsed ? SIDEBAR_COLLAPSED_W : sidebarWidth;

  // ─── Toggle visible (chevron) de la grosse barre mail ───────────────────
  // Pattern Outlook : un chevron persistant dans la bande noire du haut
  // plie/déplie la barre mail (recherche + Actualiser + Nouvel email +
  // onglets + filtres). État persisté en localStorage. La bande noire
  // h-16 reste TOUJOURS visible (pas d'auto-hide au scroll).
  const [mailHeaderCollapsed, toggleMailHeader] = useMailHeaderCollapsed();
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.style.setProperty("--app-top", "64px");
  }, []);
  const dragStateRef = useRef<{ startX: number; startW: number } | null>(null);
  const handleSidebarDragStart = (e: React.MouseEvent) => {
    if (sidebarCollapsed) return;
    e.preventDefault();
    dragStateRef.current = { startX: e.clientX, startW: sidebarWidth };
    const onMove = (ev: MouseEvent) => {
      if (!dragStateRef.current) return;
      const delta = ev.clientX - dragStateRef.current.startX;
      const next = Math.max(
        SIDEBAR_MIN,
        Math.min(SIDEBAR_MAX, dragStateRef.current.startW + delta),
      );
      setSidebarWidth(next);
    };
    const onUp = () => {
      dragStateRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (userMenuWrapRef.current && !userMenuWrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);
  const { theme: ncvTheme, toggle: toggleNcvTheme } = useNcvTheme();

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
    // Note (task #286 / refonte sidebar) : « Activité équipe » a été
    // renommé « Assignés » et déplacé dans la barre d'onglets de la
    // Réception (cf. pages/dashboard/index.tsx). On le garde hors du
    // menu latéral pour éviter la redondance.
    // Note (task #293) : « Reportés » a été déplacé dans la barre d'onglets
    // de la Réception, à côté de Tâches. Retiré de la sidebar pour éviter
    // la redondance, comme « Tâches » avant lui (#290).
    { name: t("sidebar.scheduled", "Programmés"), href: "/dashboard/programmes", icon: CalendarClock },
    // Note (task #290) : « Tâches » a été déplacé dans la barre d'onglets
    // de la Réception, à côté d'Assignés. Retiré de la sidebar pour éviter
    // la redondance, comme « Activité équipe » avant lui (#286).
    // « Relances » déplacé dans la barre d'onglets de la Réception (à droite
    // de Projets) — vit dans la Réception comme Tâches/Projets/Reportés.
    // « Projets » déplacé dans la barre d'onglets de la Réception (à droite
    // de Tâches) — projets = entité d'équipe, vit dans la Réception.
    { name: t("sidebar.contacts", "Contacts"), href: "/dashboard/contacts", icon: Users },
    { name: t("sidebar.agenda"), href: "/dashboard/agenda", icon: CalendarDays },
    // Task #294 Phase 1 — « Archives » retiré de la sidebar et déplacé en
    // onglet de la Réception (à droite de Relances). À la place : « Mes
    // dossiers » personnels (privés, classement IA auto).
    { name: t("folders.title", { defaultValue: "Mes dossiers" }), href: "/dashboard/dossiers", icon: FolderOpen },
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

  const SidebarContent = ({ collapsed = false }: { collapsed?: boolean }) => (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          "flex shrink-0 flex-col items-center justify-center border-b border-[#1f2937]",
          collapsed ? "h-16 px-1" : "h-28 px-4",
        )}
      >
        <img
          src={appLogo}
          alt="Inboria"
          className={cn(
            "object-contain",
            collapsed ? "h-10 w-auto" : "h-24 w-auto",
          )}
        />
      </div>

      <nav className={cn("flex-1 py-2.5 space-y-0.5", collapsed ? "px-1.5" : "px-2")}>
        {navigation.map((item) => {
          const isActive = location === item.href;
          const linkEl = (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                isActive
                  ? "bg-[#1e3a5f] text-primary"
                  : "text-[#b8c5d6] hover:text-white hover:bg-white/[0.04]",
                "group flex items-center rounded-md text-[13px] font-medium transition-colors",
                collapsed
                  ? "h-8 w-8 mx-auto justify-center"
                  : "gap-x-2.5 px-2.5 py-[7px]",
              )}
              title={collapsed ? item.name : undefined}
              aria-label={collapsed ? item.name : undefined}
              onClick={() => {
                setMobileMenuOpen(false);
                if (location === item.href) {
                  window.dispatchEvent(
                    new CustomEvent("sidebar-nav-reset", { detail: { href: item.href } }),
                  );
                }
              }}
            >
              <item.icon
                className={cn(
                  isActive ? "text-primary" : "text-[#b8c5d6] group-hover:text-white",
                  "h-4 w-4 shrink-0 transition-colors",
                )}
                aria-hidden="true"
              />
              {!collapsed && <span className="flex-1 truncate">{item.name}</span>}
            </Link>
          );
          return linkEl;
        })}
      </nav>

      {/* Bouton collapse / expand — visible uniquement sur desktop (lg+) */}
      <div className="hidden lg:flex shrink-0 border-t border-[#1f2937] p-2 justify-center">
        <button
          type="button"
          onClick={() => setSidebarCollapsed((v) => !v)}
          className="inline-flex items-center justify-center h-8 w-8 rounded-md text-[#b8c5d6] hover:text-white hover:bg-white/[0.04] transition-colors"
          title={
            sidebarCollapsed
              ? t("sidebar.expand", "Agrandir le menu")
              : t("sidebar.collapse", "Réduire le menu")
          }
          aria-label={
            sidebarCollapsed
              ? t("sidebar.expand", "Agrandir le menu")
              : t("sidebar.collapse", "Réduire le menu")
          }
          data-testid="sidebar-toggle-collapse"
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );

  const UserMenu = () => {
    return (
      <div ref={userMenuWrapRef} className="relative">
        <button
          type="button"
          className="flex items-center justify-center h-8 w-8 rounded-full hover:ring-2 hover:ring-primary/40 transition-all"
          data-testid="user-menu-trigger"
          aria-label={t("sidebar.user")}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <div className="h-8 w-8 rounded-full bg-[#1e3a5f] flex items-center justify-center text-[12px] font-semibold text-primary shrink-0">
            {(((user as any).fullName || "").trim().charAt(0)
              || ((user as any).email || "").trim().charAt(0)
              || t("sidebar.user").charAt(0)
            ).toUpperCase()}
          </div>
        </button>
        {open && (
          <div
            role="menu"
            className="absolute right-0 top-full mt-1 w-56 rounded-md border border-border bg-popover text-popover-foreground shadow-md z-50 p-1"
          >
            <div className="px-2 py-1.5">
              <div className="flex flex-col">
                <span className="text-[13px] font-medium text-white truncate">
                  {(user as any).fullName || (user as any).email || t("sidebar.user")}
                </span>
                <span className="text-[11px] text-[#b8c5d6] capitalize">
                  {(user as any).plan}
                </span>
              </div>
            </div>
            <div className="my-1 h-px bg-border" />
            {isOrgMember ? (
              <Link
                href="/dashboard/parametres"
                onClick={() => setOpen(false)}
                className="flex items-center px-2 py-1.5 text-sm rounded-sm cursor-pointer hover:bg-accent hover:text-accent-foreground"
                data-testid="user-menu-settings"
              >
                <Settings className="h-4 w-4 mr-2" />
                {t("sidebar.settings")}
              </Link>
            ) : (
              <>
                <Link
                  href="/dashboard/abonnement"
                  onClick={() => setOpen(false)}
                  className="flex items-center px-2 py-1.5 text-sm rounded-sm cursor-pointer hover:bg-accent hover:text-accent-foreground"
                  data-testid="user-menu-subscription"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  {t("sidebar.subscription")}
                </Link>
                <Link
                  href="/dashboard/parametres"
                  onClick={() => setOpen(false)}
                  className="flex items-center px-2 py-1.5 text-sm rounded-sm cursor-pointer hover:bg-accent hover:text-accent-foreground"
                  data-testid="user-menu-settings"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  {t("sidebar.settings")}
                </Link>
              </>
            )}
            <div className="my-1 h-px bg-border" />
            <button
              type="button"
              onClick={() => { setOpen(false); handleLogout(); }}
              className="w-full flex items-center px-2 py-1.5 text-sm rounded-sm cursor-pointer text-red-400 hover:text-red-300 hover:bg-red-500/10"
              data-testid="user-menu-logout"
            >
              <LogOut className="h-4 w-4 mr-2" />
              {t("nav.logout")}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="min-h-screen bg-background flex"
      style={{ ["--sb-w" as any]: `${effectiveSidebarW}px` }}
    >
      <div
        className="hidden lg:fixed lg:inset-y-0 lg:flex lg:flex-col z-40 transition-[width] duration-150"
        style={{ width: `var(--sb-w)` }}
      >
        <div className="relative flex grow flex-col overflow-y-auto bg-sidebar border-r border-[#1f2937]">
          <SidebarContent collapsed={sidebarCollapsed} />
          {/* Drag handle — uniquement quand non collapsed */}
          {!sidebarCollapsed && (
            <div
              onMouseDown={handleSidebarDragStart}
              role="separator"
              aria-orientation="vertical"
              aria-label={t("sidebar.resize", "Redimensionner le menu")}
              className="absolute top-0 right-0 h-full w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-50"
              data-testid="sidebar-resize-handle"
            />
          )}
        </div>
      </div>

      {rightSidebar && (
        <aside className="hidden md:flex md:fixed md:inset-y-0 md:right-0 md:w-[260px] flex-col bg-sidebar border-l border-[#1f2937] z-30">
          <div className="h-16 shrink-0 border-b border-[#1f2937] px-3 flex items-center justify-center gap-1.5">
            <NotificationBell />
            <button
              type="button"
              onClick={toggleNcvTheme}
              className="inline-flex items-center justify-center h-8 w-8 rounded-md text-[#b8c5d6] hover:text-white hover:bg-white/[0.04] transition-colors"
              title={ncvTheme === "dark" ? t("inbox.theme.switchLight", "Mode clair") : t("inbox.theme.switchDark", "Mode sombre")}
              aria-label={ncvTheme === "dark" ? t("inbox.theme.switchLight", "Mode clair") : t("inbox.theme.switchDark", "Mode sombre")}
              data-testid="ncv-theme-toggle-header-right"
            >
              {ncvTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <LanguageSwitcher />
            <SupportChatWidget />
            <UserMenu />
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-2.5">
            {rightSidebar}
          </div>
        </aside>
      )}

      <div
        className={cn(
          "flex flex-col flex-1 min-w-0 lg:pl-[var(--sb-w)] transition-[padding] duration-150",
          rightSidebar && "md:pr-[260px]",
        )}
      >
        <div
          className="sticky top-0 z-20 flex h-auto md:h-16 shrink-0 flex-wrap md:flex-nowrap items-center gap-x-4 gap-y-2 border-b border-border bg-background px-4 py-2 md:py-0"
          data-testid="app-top-header"
        >
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
            <div className="flex items-center gap-2 ml-2 shrink-0">
              <img src={appLogo} alt="Inboria" className="h-12 sm:h-14 w-auto object-contain shrink-0" />
            </div>
          </div>
          <div className="hidden md:block flex-1" />
          <div className="basis-full h-0 md:hidden" aria-hidden="true" />
          <div className="flex items-center flex-wrap md:flex-nowrap justify-between md:justify-end gap-1 sm:gap-2 w-full md:w-auto md:shrink-0">
            <div className="shrink-0"><InboriaChatButton /></div>
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <div className="block"><AutopilotIndicator /></div>
            <button
              type="button"
              onClick={toggleMailHeader}
              className="inline-flex items-center justify-center h-8 w-8 rounded-md text-[#b8c5d6] hover:text-white hover:bg-white/[0.04] transition-colors"
              title={mailHeaderCollapsed ? "Afficher la barre mail" : "Masquer la barre mail"}
              aria-label={mailHeaderCollapsed ? "Afficher la barre mail" : "Masquer la barre mail"}
              data-testid="mail-header-toggle"
            >
              {mailHeaderCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </button>
            <div className={cn("flex items-center gap-2", rightSidebar && "md:hidden")}>
              <NotificationBell />
              <button
                type="button"
                onClick={toggleNcvTheme}
                className="inline-flex items-center justify-center h-8 w-8 rounded-md text-[#b8c5d6] hover:text-white hover:bg-white/[0.04] transition-colors"
                title={ncvTheme === "dark" ? t("inbox.theme.switchLight", "Mode clair") : t("inbox.theme.switchDark", "Mode sombre")}
                aria-label={ncvTheme === "dark" ? t("inbox.theme.switchLight", "Mode clair") : t("inbox.theme.switchDark", "Mode sombre")}
                data-testid="ncv-theme-toggle-header-top"
              >
                {ncvTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>
            </div>
            <div className="basis-full h-0 md:hidden" aria-hidden="true" />
            <div className={cn("flex items-center gap-2 shrink-0 mr-auto md:mr-0", rightSidebar && "md:hidden")}>
              <LanguageSwitcher />
              <SupportChatWidget />
              <UserMenu />
            </div>
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
    </div>
  );
}
