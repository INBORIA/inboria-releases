import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import {
  Inbox,
  Send,
  Clock,
  CalendarClock,
  Bell,
  ListTodo,
  Archive,
  Folder,
  BarChart3,
  Users,
  Tags,
  PenSquare,
  Sun,
  Moon,
  Keyboard,
} from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { useNcvTheme } from "@/lib/inbox-theme";

/**
 * T003 — Palette de commandes globale (style Superhuman / Linear).
 * Montée une seule fois dans DashboardLayout, donc disponible sur TOUTES les
 * pages du tableau de bord. Cmd/Ctrl+K l'ouvre ; Échap la ferme ; la saisie
 * filtre ; Entrée exécute. La navigation utilise wouter, le compose réutilise
 * le mécanisme existant (event "inboria-open-compose" sur la Réception, sinon
 * "/dashboard?compose=1"), le thème réutilise useNcvTheme.
 */
export function CommandPalette() {
  const { t } = useTranslation();
  const [location, navigate] = useLocation();
  const { theme, toggle } = useNcvTheme();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  const go = (path: string) => run(() => navigate(path));

  const openCompose = () =>
    run(() => {
      if (location === "/dashboard") {
        window.dispatchEvent(new CustomEvent("inboria-open-compose"));
      } else {
        navigate("/dashboard?compose=1");
      }
    });

  const nav: Array<{ icon: typeof Inbox; label: string; path: string }> = [
    { icon: Inbox, label: t("nav.inbox", "Réception"), path: "/dashboard" },
    { icon: Send, label: t("nav.sent", "Envoyés"), path: "/dashboard/envoyes" },
    { icon: CalendarClock, label: t("nav.scheduled", "Programmés"), path: "/dashboard/programmes" },
    { icon: Clock, label: t("nav.snoozed", "Reportés"), path: "/dashboard/reportes" },
    { icon: Bell, label: t("nav.followups", "Relances"), path: "/dashboard/relances" },
    { icon: ListTodo, label: t("nav.tasks", "Tâches"), path: "/dashboard/taches" },
    { icon: Archive, label: t("nav.archives", "Archives"), path: "/dashboard/archives" },
    { icon: Folder, label: t("nav.folders", "Mes dossiers"), path: "/dashboard/dossiers" },
    { icon: BarChart3, label: t("nav.dailyBrief", "Bilan quotidien"), path: "/dashboard/bilan" },
    { icon: Users, label: t("nav.contacts", "Contacts"), path: "/dashboard/contacts" },
    { icon: Tags, label: t("nav.categories", "Catégories"), path: "/dashboard/classement" },
  ];

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder={t("palette.placeholder", "Tapez une commande ou recherchez…")} />
      <CommandList>
        <CommandEmpty>{t("palette.empty", "Aucun résultat.")}</CommandEmpty>
        <CommandGroup heading={t("palette.actions", "Actions")}>
          <CommandItem value="compose nouvel email" onSelect={openCompose}>
            <PenSquare className="mr-2 h-4 w-4" />
            {t("palette.compose", "Nouvel email")}
          </CommandItem>
          <CommandItem value="theme thème clair sombre" onSelect={() => run(toggle)}>
            {theme === "dark" ? (
              <Sun className="mr-2 h-4 w-4" />
            ) : (
              <Moon className="mr-2 h-4 w-4" />
            )}
            {theme === "dark"
              ? t("inbox.theme.switchLight", "Mode clair")
              : t("inbox.theme.switchDark", "Mode sombre")}
          </CommandItem>
          <CommandItem
            value="raccourcis clavier shortcuts"
            onSelect={() => run(() => window.dispatchEvent(new CustomEvent("inboria-show-shortcuts")))}
          >
            <Keyboard className="mr-2 h-4 w-4" />
            {t("palette.shortcuts", "Raccourcis clavier")}
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading={t("palette.navigate", "Naviguer")}>
          {nav.map(({ icon: Icon, label, path }) => (
            <CommandItem key={path} value={`${label} ${path}`} onSelect={() => go(path)}>
              <Icon className="mr-2 h-4 w-4" />
              {label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
