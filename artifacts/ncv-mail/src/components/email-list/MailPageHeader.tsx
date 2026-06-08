import { memo, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  Archive,
  BellOff,
  CheckSquare,
  ChevronsDownUp,
  ChevronsUpDown,
  FolderKanban,
  Inbox,
  MailCheck,
  PenSquare,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  useListEmails,
  useGetSharedMailboxes,
  useGetMyOrganisation,
  useGetOrganisationMembers,
  useGetTeamAssignments,
  useGetProfile,
  useListProjects,
  useSendEmail,
} from "@workspace/api-client-react";
import type {
  PaginatedEmails,
  SendEmailBody,
  SendEmail200,
  Project,
  SharedMailbox,
  OrganisationMember,
} from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useReadingPaneEnabled } from "@/lib/use-reading-pane";
import { ViewOptionsMenu } from "@/components/email-list/ViewOptionsMenu";
import { useMailHeaderCollapsed } from "@/lib/use-mail-header-collapsed";
import { PanelRight, PanelRightClose } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  ComposeDialogBody,
  type ComposeSendPayload,
} from "@/pages/dashboard/index";

type ComposeConnection = {
  id: string;
  provider: string;
  email_address: string;
  signature?: string | null;
  consecutive_failures?: number | null;
  last_error_message?: string | null;
};

type CurrentTab =
  | "inbox"
  | "envoyes"
  | "programmes"
  | "dossiers"
  | "indesirables"
  | "corbeille"
  | "reportes"
  | "taches"
  | "projets"
  | "relances"
  | "archives"
  | "activite-equipe"
  | "contacts"
  | "agenda"
  | "bilan"
  | "classement"
  | "templates"
  | "regles";

interface MailPageHeaderProps {
  currentTab: CurrentTab;
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  showReadingPaneToggle?: boolean;
  showHeaderCollapseToggle?: boolean;
}

function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function MailPageHeaderImpl({
  currentTab,
  searchValue,
  onSearchChange,
  showReadingPaneToggle = true,
  showHeaderCollapseToggle = true,
}: MailPageHeaderProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // ─── Volet de lecture (3e colonne) — toggle global persisté ──────────────
  const [readingPaneEnabled, toggleReadingPane] = useReadingPaneEnabled();

  // ─── Header collapse — synchronisé avec le chevron de la bande du haut ───
  // (cf. DashboardLayout) via le hook partagé `useMailHeaderCollapsed`.
  const [headerCollapsed, toggleHeaderCollapsed] = useMailHeaderCollapsed();

  // ─── Recherche ────────────────────────────────────────────────────────────
  const [internalSearch, setInternalSearch] = useState(searchValue ?? "");
  const searchInput = searchValue !== undefined ? searchValue : internalSearch;
  const setSearchInput = (v: string) => {
    if (onSearchChange) onSearchChange(v);
    else setInternalSearch(v);
  };
  // Debounce conservé pour parité d'API si jamais consommé plus tard.
  useDebounce(searchInput, 300);
  // Recherche unifiée : où qu'on soit, valider une recherche renvoie sur la
  // Réception avec le texte appliqué (?q=...) → un seul comportement partout.
  const submitSearch = useCallback(() => {
    const q = (searchInput || "").trim();
    navigate(q ? `/dashboard?q=${encodeURIComponent(q)}` : "/dashboard");
  }, [searchInput, navigate]);

  // ─── Compose / Sync ──────────────────────────────────────────────────────
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isComposeFullscreen, setIsComposeFullscreen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const sendEmailMut = useSendEmail();

  const { data: composeConnections } = useQuery<ComposeConnection[]>({
    queryKey: ["email-connections-compose"],
    queryFn: async () => {
      const { supabase } = await import("@/lib/supabase");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch(`${import.meta.env.BASE_URL}api/email/connections`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: projects } = useListProjects();

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const { supabase } = await import("@/lib/supabase");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch(`${import.meta.env.BASE_URL}api/email/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      if (res.ok) {
        qc.invalidateQueries();
        const count = data.synced || 0;
        if (count > 0) {
          toast({
            title: t("inbox.syncComplete"),
            description: t("inbox.syncNewEmails", { count }),
          });
        }
      } else {
        const isNoConnection =
          typeof data?.error === "string" &&
          /aucun compte email connecte/i.test(data.error);
        if (isNoConnection) {
          toast({
            title: "Aucune boîte connectée",
            description:
              "Connectez Gmail ou Outlook dans Réglages › Connexions pour synchroniser vos mails.",
          });
        } else {
          toast({
            variant: "destructive",
            title: t("common.error"),
            description: data.error,
          });
        }
      }
    } catch {
      toast({ variant: "destructive", title: t("common.error") });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleComposeSend = useCallback(
    (p: ComposeSendPayload) => {
      if (!p.to.trim() || !p.subject.trim() || !p.body.trim()) return;
      const payload: SendEmailBody = {
        to: p.to,
        subject: p.subject,
        body: p.body,
        replyToEmailId: null,
        attachments:
          p.attachments.length > 0 ? p.attachments.map((a) => a.uploadId) : undefined,
        ...(p.cc && p.cc.trim() ? { cc: p.cc.trim() } : {}),
        ...(p.bcc && p.bcc.trim() ? { bcc: p.bcc.trim() } : {}),
        ...(p.connectionId ? { connectionId: p.connectionId } : {}),
        ...(p.projectId ? { projectId: p.projectId } : {}),
      };
      sendEmailMut.mutate(
        { data: payload },
        {
          onSuccess: (resp: SendEmail200) => {
            qc.invalidateQueries();
            setIsComposeOpen(false);
            setIsComposeFullscreen(false);
            const appointmentId = (resp as { appointmentId?: number | string })
              ?.appointmentId;
            if (appointmentId) {
              toast({
                title: t("inbox.emailSent"),
                description: t(
                  "inbox.appointmentProposed",
                  "Rendez-vous proposé créé dans l'agenda",
                ),
              });
            } else {
              toast({ title: t("inbox.emailSent") });
            }
          },
          onError: (err: unknown) => {
            const e = err as
              | { data?: { error?: string }; message?: string }
              | undefined;
            const msg = e?.data?.error || e?.message || t("inbox.sendError");
            toast({
              variant: "destructive",
              title: t("common.error"),
              description: msg,
            });
          },
        },
      );
    },
    [sendEmailMut, qc, t, toast],
  );

  // ─── Compteurs ────────────────────────────────────────────────────────────
  const { data: trashCountData } = useListEmails({ status: "trashed", page: 1, limit: 1 });
  const trashCountFromApi = (trashCountData as PaginatedEmails)?.total ?? 0;

  const { data: spamCountData } = useListEmails({ status: "spam", page: 1, limit: 1 });
  const spamCountFromApi = (spamCountData as PaginatedEmails)?.total ?? 0;

  const { data: inboxCountData } = useListEmails({ page: 1, limit: 1 });
  const inboxCountFromApi = (inboxCountData as PaginatedEmails)?.total ?? 0;

  // ─── Profil / orga / partagées ───────────────────────────────────────────
  const { data: profile } = useGetProfile();
  const profileTyped = profile as
    | { id?: string; plan?: string }
    | undefined;
  const { data: myOrg } = useGetMyOrganisation();
  const myOrgId = (myOrg as { id?: string } | undefined)?.id;
  const { data: orgMembers } = useGetOrganisationMembers({
    query: { enabled: !!myOrgId } as NonNullable<Parameters<typeof useGetOrganisationMembers>[0]>["query"],
  });
  const teamMembersActiveCount = Array.isArray(orgMembers)
    ? (orgMembers as OrganisationMember[]).filter(
        (m) => (m as { status?: string }).status === "active",
      ).length
    : 0;
  const hasTeamForAssigned = !!myOrgId && teamMembersActiveCount > 1;

  const { data: teamAssignmentsData } = useGetTeamAssignments({
    query: { enabled: hasTeamForAssigned } as NonNullable<Parameters<typeof useGetTeamAssignments>[0]>["query"],
  });
  const assignedToMeCount = (() => {
    const members = (
      teamAssignmentsData as
        | { members?: Array<{ isCurrentUser?: boolean; emails?: unknown[] }> }
        | undefined
    )?.members;
    if (!members) return 0;
    const me = members.find((m) => m.isCurrentUser);
    return me?.emails?.length ?? 0;
  })();

  const plan = profileTyped?.plan ?? "starter";
  const { data: sharedMailboxes } = useGetSharedMailboxes({
    query: { enabled: plan === "business" } as NonNullable<Parameters<typeof useGetSharedMailboxes>[0]>["query"],
  });
  const sharedList = (sharedMailboxes as SharedMailbox[] | undefined) ?? [];
  const hasSharedMailboxes = plan === "business" && sharedList.length > 0;
  const sharedMailboxesCount = sharedList.length;

  // Compteur Projets — badge du seul onglet à compteur restant dans le
  // bandeau (Reportés/Relances/Archives/Tâches sont passés dans la sidebar).
  const { data: projectsData } = useQuery<unknown[]>({
    queryKey: ["projects-count"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { supabase } = await import("@/lib/supabase");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) return [];
      const res = await fetch(`${import.meta.env.BASE_URL}api/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
  });
  const projectsCount = Array.isArray(projectsData) ? projectsData.length : 0;

  // ─── Sélecteur "Tous les comptes" ────────────────────────────────────────
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const uid = profileTyped?.id;
    if (!uid) {
      setSelectedAccountId("all");
      return;
    }
    const stored = window.localStorage.getItem(`inboria.selectedAccount:${uid}`);
    setSelectedAccountId(stored || "all");
  }, [profileTyped?.id]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const uid = profileTyped?.id;
    if (!uid) return;
    window.localStorage.setItem(
      `inboria.selectedAccount:${uid}`,
      selectedAccountId,
    );
  }, [selectedAccountId, profileTyped?.id]);

  // ─── Helpers UI ───────────────────────────────────────────────────────────
  const tabBaseClass =
    "inline-flex items-center justify-center gap-1 h-7 px-2.5 text-[11px] rounded-md font-medium transition-colors whitespace-nowrap";
  const tabActiveClass = "bg-primary/15 text-primary border border-primary/20";
  const tabIdleClass =
    "text-[#b8c5d6] border border-[#1f2937] hover:text-white hover:border-[#b8c5d6]/30";
  const cls = (active: boolean) =>
    `${tabBaseClass} ${active ? tabActiveClass : tabIdleClass}`;

  const isInbox = currentTab === "inbox";

  if (headerCollapsed) {
    return null;
  }

  return (
    <div
      className="sticky top-16 z-[5] bg-background pt-4 pb-2.5 border-b border-border"
    >
      {/* Bloc A — recherche + Actualiser + Nouvel email */}
      <div className="flex items-center gap-2 mb-2.5 max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8">
        <div className="flex-1 relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8b95a7]" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitSearch();
              }
            }}
            placeholder={t("inbox.searchPlaceholder")}
            className="pl-8 pr-16 bg-card border-border text-foreground placeholder:text-muted-foreground h-9 text-[13px] rounded-md"
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8b95a7] hover:text-white"
              aria-label="Effacer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 h-9 text-[12px] bg-transparent border-[#1f2630] text-[#b8c5d6] hover:text-white hover:bg-white/[0.04] shrink-0"
          onClick={handleSync}
          disabled={isSyncing}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">
            {isSyncing ? t("inbox.refreshing") : t("inbox.refresh")}
          </span>
        </Button>

        <Dialog
          open={isComposeOpen}
          onOpenChange={(open) => {
            setIsComposeOpen(open);
            if (!open) setIsComposeFullscreen(false);
          }}
        >
          <DialogTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 h-9 px-3 text-[12px] bg-card hover:bg-white/[0.04] text-[#e6e9ef] border-[#1f2937] hover:border-[#2a3441] shrink-0 rounded-md font-medium"
            >
              <PenSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t("inbox.newEmail")}</span>
            </Button>
          </DialogTrigger>
          <DialogContent
            aria-describedby={undefined}
            // [&>button.absolute]:hidden — cache le X auto de shadcn
            // (DialogPrimitive.Close en absolute top-right ajouté par
            // notre wrapper components/ui/dialog.tsx). Le composer a
            // déjà son propre X dans ComposeDialogBody, avec confirm
            // "Abandonner ce brouillon ?".
            className={
              (isComposeFullscreen
                ? "bg-card border-border w-screen max-w-none h-screen sm:rounded-none p-0 flex flex-col"
                : "bg-card border-border w-[95vw] sm:max-w-3xl p-0 flex flex-col max-h-[90vh]")
              + " [&>button.absolute]:hidden"
            }
          >
            {isComposeOpen && (
              <ComposeDialogBody
                isFullscreen={isComposeFullscreen}
                setIsFullscreen={setIsComposeFullscreen}
                connections={composeConnections || []}
                projects={(projects as Project[] | undefined) ?? []}
                isPending={sendEmailMut.isPending}
                onSend={handleComposeSend}
                onClose={() => {
                  setIsComposeOpen(false);
                  setIsComposeFullscreen(false);
                }}
              />
            )}
          </DialogContent>
        </Dialog>

        <ViewOptionsMenu />

        {showReadingPaneToggle && (
          <button
            type="button"
            onClick={() => toggleReadingPane()}
            className={`inline-flex items-center justify-center h-9 w-9 rounded-md border border-[#1f2630] shrink-0 ${readingPaneEnabled ? "text-primary bg-primary/10 border-primary/30" : "text-[#b8c5d6] hover:text-white hover:bg-white/[0.04]"}`}
            title={
              readingPaneEnabled
                ? t("inbox.readingPaneOff", "Désactiver le volet de lecture")
                : t("inbox.readingPaneOn", "Activer le volet de lecture (3 colonnes)")
            }
            aria-label={
              readingPaneEnabled
                ? t("inbox.readingPaneOff", "Désactiver le volet de lecture")
                : t("inbox.readingPaneOn", "Activer le volet de lecture (3 colonnes)")
            }
            aria-pressed={readingPaneEnabled}
            data-testid="mail-header-toggle-reading-pane"
          >
            {readingPaneEnabled ? (
              <PanelRightClose className="w-3.5 h-3.5" />
            ) : (
              <PanelRight className="w-3.5 h-3.5" />
            )}
          </button>
        )}

        {showHeaderCollapseToggle && (
          <button
            type="button"
            onClick={toggleHeaderCollapsed}
            className="inline-flex items-center justify-center h-9 w-9 rounded-md text-[#b8c5d6] hover:text-white hover:bg-white/[0.04] border border-[#1f2630] shrink-0"
            title={
              headerCollapsed
                ? t("inbox.headerExpand", "Afficher onglets et filtres")
                : t("inbox.headerCollapse", "Masquer onglets et filtres")
            }
            aria-label={
              headerCollapsed
                ? t("inbox.headerExpand", "Afficher onglets et filtres")
                : t("inbox.headerCollapse", "Masquer onglets et filtres")
            }
            aria-expanded={!headerCollapsed}
            data-testid="mail-header-toggle-collapse"
          >
            {headerCollapsed ? (
              <ChevronsUpDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronsDownUp className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>

      {!headerCollapsed && (
      <>
      {/* Bloc B — onglets boîtes & équipe */}
      <div className="flex flex-nowrap md:flex-wrap items-center gap-1.5 gap-y-2 max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 mb-2 overflow-x-auto md:overflow-visible [&::-webkit-scrollbar]:hidden [scrollbar-width:none] [&>*]:shrink-0">
        {isInbox ? (
          <button className={cls(true)} type="button">
            <Inbox className="w-3 h-3" />
            {t("inbox.title")}
            {inboxCountFromApi > 0 && (
              <span className="text-[10px] tabular-nums bg-white/10 text-white px-1.5 py-0.5 rounded-full">
                {inboxCountFromApi}
              </span>
            )}
          </button>
        ) : (
          <Link href="/dashboard" className={cls(false)}>
            <Inbox className="w-3 h-3" />
            {t("inbox.title")}
            {inboxCountFromApi > 0 && (
              <span className="text-[10px] tabular-nums bg-white/10 text-white px-1.5 py-0.5 rounded-full">
                {inboxCountFromApi}
              </span>
            )}
          </Link>
        )}

        <span className="w-px h-5 bg-border/60 mx-1" aria-hidden="true" />

        <Link href="/dashboard/indesirables" className={cls(currentTab === "indesirables")}>
          <ShieldAlert className="w-3 h-3" />
          {t("inbox.spamShort", "Indésirables")}
          {spamCountFromApi > 0 && (
            <span className="text-[10px] tabular-nums bg-white/10 text-white px-1.5 py-0.5 rounded-full">
              {spamCountFromApi}
            </span>
          )}
        </Link>

        <Link href="/dashboard/corbeille" className={cls(currentTab === "corbeille")}>
          <Trash2 className="w-3 h-3" />
          {t("inbox.trash")}
          {trashCountFromApi > 0 && (
            <span className="text-[10px] tabular-nums bg-white/10 text-white px-1.5 py-0.5 rounded-full">
              {trashCountFromApi}
            </span>
          )}
        </Link>

        {(composeConnections?.length || 0) >= 2 && (
          <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
            <SelectTrigger className="w-[140px] h-7 bg-card border-border text-[#b8c5d6] text-[11px]">
              <SelectValue placeholder={t("inbox.accountFilter")} />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">{t("inbox.allAccounts")}</SelectItem>
              {composeConnections?.map((c) => {
                const isDown = (c.consecutive_failures ?? 0) >= 3;
                return (
                  <SelectItem key={c.id} value={String(c.id)}>
                    <span className="inline-flex items-center gap-1.5">
                      {isDown && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                      <span className={isDown ? "text-red-400" : ""}>{c.email_address}</span>
                      {isDown && <AlertCircle className="w-3 h-3 text-red-400 ml-1" />}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        )}

        {(() => {
          const downConns = (composeConnections || []).filter(
            (c) => (c.consecutive_failures ?? 0) >= 3,
          );
          if (downConns.length === 0) return null;
          return (
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="/dashboard/parametres"
                    className="inline-flex items-center gap-1 ml-1 px-2 py-0.5 rounded-md border border-red-500/30 bg-red-500/10 text-red-400 text-[11px] font-medium hover:bg-red-500/20 transition-colors"
                  >
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>
                      {t("inbox.disconnectedAccountsLabel", {
                        count: downConns.length,
                        defaultValue_one: "1 boîte hors service",
                        defaultValue_other: "{{count}} boîtes hors service",
                      })}
                    </span>
                  </Link>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-[11px] font-medium mb-1">
                    {t("inbox.disconnectedTooltipTitle", {
                      defaultValue: "Compte(s) déconnecté(s)",
                    })}
                  </p>
                  <ul className="text-[11px] text-[#b8c5d6] space-y-0.5">
                    {downConns.map((c) => (
                      <li key={c.id}>• {c.email_address}</li>
                    ))}
                  </ul>
                  <p className="text-[11px] mt-1.5 text-[#b8c5d6]">
                    {t("inbox.disconnectedTooltipCta", {
                      defaultValue: "Cliquez pour reconnecter dans Paramètres.",
                    })}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })()}

        <div
          aria-hidden="true"
          className="hidden md:block"
          style={{ flexBasis: "100%", width: "100%", height: 0 }}
        />

        {hasSharedMailboxes && (
          <Link href="/dashboard?mode=shared" className={cls(false)}>
            <Users className="w-3 h-3" />
            {t("inbox.sharedMailboxShort", "Boîtes partagées")}
            {sharedMailboxesCount > 0 && (
              <span className="text-[10px] tabular-nums bg-white/10 text-white px-1.5 py-0.5 rounded-full">
                {sharedMailboxesCount}
              </span>
            )}
          </Link>
        )}

        {hasTeamForAssigned && (
          <Link
            href="/dashboard/activite-equipe"
            className={cls(currentTab === "activite-equipe")}
          >
            <Activity className="w-3 h-3" />
            {t("inbox.assignedShort", "Mails assignés")}
            {assignedToMeCount > 0 && (
              <span className="text-[10px] tabular-nums bg-white/10 text-white px-1.5 py-0.5 rounded-full">
                {assignedToMeCount}
              </span>
            )}
          </Link>
        )}

        <Link href="/dashboard/taches?scope=team" className={cls(currentTab === "taches")}>
          <CheckSquare className="w-3 h-3" />
          {t("inbox.teamTasks", "Tâches équipe")}
        </Link>

        <Link href="/dashboard/projets" className={cls(currentTab === "projets")}>
          <FolderKanban className="w-3 h-3" />
          {t("sidebar.projects")}
          {projectsCount > 0 && (
            <span className="text-[10px] tabular-nums bg-white/10 text-white px-1.5 py-0.5 rounded-full">
              {projectsCount}
            </span>
          )}
        </Link>

      </div>

      </>
      )}
    </div>
  );
}

export const MailPageHeader = memo(MailPageHeaderImpl);
