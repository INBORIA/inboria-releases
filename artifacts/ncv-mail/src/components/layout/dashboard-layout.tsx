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
} from "lucide-react";
import ncvLogo from "@assets/image_1775392688923.png";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const navigation = [
  { name: "Inbox", href: "/dashboard", icon: Inbox },
  { name: "Archives", href: "/dashboard/archives", icon: Archive },
  { name: "Bilan quotidien", href: "/dashboard/bilan", icon: LayoutDashboard },
  { name: "Taches", href: "/dashboard/taches", icon: CheckSquare },
  { name: "Projets", href: "/dashboard/projets", icon: FolderKanban },
  { name: "Categories", href: "/dashboard/categories", icon: Tags },
  { name: "Parametres", href: "/dashboard/parametres", icon: Settings },
  { name: "Abonnement", href: "/dashboard/abonnement", icon: CreditCard },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { signOut } = useAuth();
  const { data: profile, isLoading } = useGetProfile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const user = profile || { fullName: "", plan: "essai", emailsUsed: 0, emailsQuota: 100 };

  const isExpired = (user as any).plan === "expired";
  const isTrialExhausted = (user as any).plan === "essai" && (user as any).emailsUsed >= (user as any).emailsQuota;
  const isBlocked = isExpired || isTrialExhausted;

  const allowedWhenBlocked = ["/dashboard/abonnement", "/dashboard/parametres"];

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
      <div className="flex h-20 shrink-0 items-center px-5">
        <div className="flex items-center gap-3">
          <img src={ncvLogo} alt="NCV" className="h-28 w-28 object-contain" />
          <span className="font-semibold text-[15px] tracking-tight text-white">NCV Mail</span>
        </div>
      </div>
      
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {navigation.map((item) => {
          const isActive = location === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                isActive
                  ? "bg-[#1e3a5f] text-primary"
                  : "text-[#8b9cb3] hover:text-white hover:bg-white/[0.04]",
                "group flex items-center gap-x-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors"
              )}
              onClick={() => setMobileMenuOpen(false)}
            >
              <item.icon
                className={cn(
                  isActive ? "text-primary" : "text-[#8b9cb3] group-hover:text-white",
                  "h-[18px] w-[18px] shrink-0 transition-colors"
                )}
                aria-hidden="true"
              />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 mt-auto border-t border-[#1f2937]">
        <div className="px-3 py-2.5 mb-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[11px] font-medium text-[#8b9cb3] uppercase tracking-wider">
              Quota emails
            </span>
            <span className="text-[11px] font-medium text-white">
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
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-[#1e3a5f] flex items-center justify-center text-xs font-semibold text-primary">
              {((user as any).fullName || "U").charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] font-medium text-white truncate max-w-[120px]">
                {(user as any).fullName || "Utilisateur"}
              </span>
              <span className="text-[11px] text-[#8b9cb3] capitalize">
                {(user as any).plan}
              </span>
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-[#8b9cb3] hover:text-white hover:bg-white/[0.06] h-8 w-8"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Se déconnecter</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-[240px] lg:flex-col">
        <div className="flex grow flex-col overflow-y-auto bg-sidebar border-r border-[#1f2937]">
          <SidebarContent />
        </div>
      </div>

      <div className="lg:pl-[240px] flex flex-col flex-1 min-w-0">
        <div className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-x-4 border-b border-border bg-background px-4 lg:hidden">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-white">
                <span className="sr-only">Ouvrir le menu</span>
                <Menu className="h-5 w-5" aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 bg-sidebar w-[240px] border-r border-[#1f2937]">
              <SidebarContent />
            </SheetContent>
          </Sheet>
          <div className="flex flex-1 items-center gap-2">
            <img src={ncvLogo} alt="NCV" className="h-8 w-8 object-contain" />
            <span className="font-semibold text-[15px] text-white">NCV Mail</span>
          </div>
        </div>

        <main className="flex-1">
          {isBlocked && location !== "/dashboard/abonnement" && (
            <div className="bg-red-500/10 border-b border-red-500/20 px-6 py-4">
              <div className="flex items-center gap-3 max-w-4xl mx-auto">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-[13px] font-medium text-red-400">
                    {isExpired
                      ? "Votre abonnement a expire"
                      : "Votre essai gratuit est termine"}
                  </p>
                  <p className="text-[11px] text-[#8b9cb3] mt-0.5">
                    {isExpired
                      ? "Reabonnez-vous pour continuer a utiliser NCV Mail."
                      : "Vous avez utilise vos 100 emails gratuits. Choisissez un plan pour continuer."}
                  </p>
                </div>
                <Link href="/dashboard/abonnement">
                  <Button size="sm" className="shrink-0">
                    Choisir un plan
                  </Button>
                </Link>
              </div>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
