import { useGetMe, useLogout } from "@workspace/api-client-react";
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
  Menu
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";

const navigation = [
  { name: "Boîte prioritaire", href: "/dashboard", icon: Inbox },
  { name: "Bilan quotidien", href: "/dashboard/bilan", icon: LayoutDashboard },
  { name: "Tâches", href: "/dashboard/taches", icon: CheckSquare },
  { name: "Catégories", href: "/dashboard/categories", icon: Tags },
  { name: "Paramètres", href: "/dashboard/parametres", icon: Settings },
  { name: "Abonnement", href: "/dashboard/abonnement", icon: CreditCard },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: user, isLoading, isError } = useGetMe({
    query: {
      retry: false,
    },
  });

  const logoutMutation = useLogout();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (isError) {
      setLocation("/login");
    }
  }, [isError, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-secondary flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        setLocation("/login");
      },
    });
  };

  const usagePercent = Math.min(
    100,
    (user.emailsUsed / Math.max(1, user.emailsQuota)) * 100
  );

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center px-6">
        <div className="flex items-center gap-3 text-sidebar-foreground">
          <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center font-bold shadow-sm">
            N
          </div>
          <span className="font-semibold text-lg tracking-tight">NCV Mail</span>
        </div>
      </div>
      
      <nav className="flex-1 space-y-1 px-4 py-4">
        {navigation.map((item) => {
          const isActive = location === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                "group flex items-center gap-x-3 rounded-md px-3 py-2 text-sm font-medium transition-colors"
              )}
              onClick={() => setMobileMenuOpen(false)}
            >
              <item.icon
                className={cn(
                  isActive ? "text-sidebar-accent-foreground" : "text-sidebar-foreground/70 group-hover:text-sidebar-foreground",
                  "h-5 w-5 shrink-0 transition-colors"
                )}
                aria-hidden="true"
              />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 mt-auto">
        <div className="bg-sidebar-accent rounded-lg p-4 mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-medium text-sidebar-foreground/70">
              Quota emails
            </span>
            <span className="text-xs font-medium text-sidebar-foreground">
              {user.emailsUsed} / {user.emailsQuota}
            </span>
          </div>
          <Progress value={usagePercent} className="h-1.5 bg-sidebar-border" indicatorClassName={usagePercent > 90 ? "bg-destructive" : "bg-primary"} />
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-sidebar-border flex items-center justify-center text-sm font-medium text-sidebar-foreground">
              {user.fullName.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-sidebar-foreground truncate max-w-[120px]">
                {user.fullName}
              </span>
              <span className="text-xs text-sidebar-foreground/70 truncate max-w-[120px]">
                Plan {user.plan}
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-secondary flex">
      {/* Desktop Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-[260px] lg:flex-col">
        <div className="flex grow flex-col overflow-y-auto bg-sidebar shadow-xl z-10">
          <SidebarContent />
        </div>
      </div>

      {/* Mobile Sidebar & Header */}
      <div className="lg:pl-[260px] flex flex-col flex-1 min-w-0">
        <div className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-x-4 border-b border-border bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:hidden">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="-m-2.5 p-2.5 text-foreground">
                <span className="sr-only">Ouvrir le menu</span>
                <Menu className="h-6 w-6" aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 bg-sidebar w-72 border-r-0">
              <SidebarContent />
            </SheetContent>
          </Sheet>
          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6 items-center">
            <span className="font-semibold text-lg tracking-tight">NCV Mail</span>
          </div>
        </div>

        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
