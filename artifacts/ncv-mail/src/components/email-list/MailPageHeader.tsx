import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  Archive,
  BellOff,
  Briefcase,
  Building2,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Cloud,
  Database,
  FolderKanban,
  Inbox,
  MailCheck,
  PenSquare,
  RefreshCw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Tags,
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
  useListIntegrations,
  useSendEmail,
} from "@workspace/api-client-react";
import type {
  PaginatedEmails,
  Integration,
  SendEmailBody,
  SendEmail200,
  Project,
  SharedMailbox,
  OrganisationMember,
} from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
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

type CrmFilter = "hubspot" | "pipedrive" | "salesforce" | "odoo" | null;

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
  | "activite-equipe";

interface MailPageHeaderProps {
  currentTab: CurrentTab;
  searchValue?: string;
  onSearchChange?: (v: string) => void;
}

function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function MailPageHeader({
  currentTab,
  searchValue,
  onSearchChange,
}: MailPageHeaderProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { toast } = useToast();

  // ─── Recherche ────────────────────────────────────────────────────────────
  const [internalSearch, setInternalSearch] = useState(searchValue ?? "");
  const searchInput = searchValue !== undefined ? searchValue : internalSearch;
  const setSearchInput = (v: string) => {
    if (onSearchChange) onSearchChange(v);
    else setInternalSearch(v);
  };
  // Debounce conservé pour parité d'API si jamais consommé plus tard.
  useDebounce(searchInput, 300);

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

  // Compteur emails reportés (snoozed)
  const { data: snoozedData } = useQuery<{ emails?: unknown[]; total?: number }>({
    queryKey: ["emails-snoozed-count"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { supabase } = await import("@/lib/supabase");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) return { emails: [] };
      const res = await fetch(
        `${import.meta.env.BASE_URL}api/emails?snoozed=1&limit=200`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) return { emails: [] };
      return res.json();
    },
  });
  const snoozedCount = snoozedData?.total ?? snoozedData?.emails?.length ?? 0;

  // Compteur tâches ouvertes
  const { data: openTasksData } = useQuery<unknown[]>({
    queryKey: ["tasks-open-mine"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { supabase } = await import("@/lib/supabase");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) return [];
      const res = await fetch(
        `${import.meta.env.BASE_URL}api/tasks?scope=mine&status=pending`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) return [];
      return res.json();
    },
  });
  const openTasksCount = Array.isArray(openTasksData) ? openTasksData.length : 0;

  // Compteurs Projets / Relances / Archives — parité avec la barre d'onglets
  // de la Réception (pages/dashboard/index.tsx L3543+). Sans ces queries, les
  // badges nombre disparaissaient dès qu'on quittait /dashboard.
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

  const { data: followupsData } = useQuery<unknown[]>({
    queryKey: ["followups-count"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { supabase } = await import("@/lib/supabase");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) return [];
      const res = await fetch(
        `${import.meta.env.BASE_URL}api/followups?status=en_attente`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) return [];
      return res.json();
    },
  });
  const followupsCount = Array.isArray(followupsData) ? followupsData.length : 0;

  const { data: archivesData } = useQuery<{ emails?: unknown[]; total?: number }>({
    queryKey: ["archives-count"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { supabase } = await import("@/lib/supabase");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) return { emails: [], total: 0 };
      const res = await fetch(
        `${import.meta.env.BASE_URL}api/emails?status=archived&limit=1`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) return { emails: [], total: 0 };
      return res.json();
    },
  });
  const archivesCount = archivesData?.total ?? archivesData?.emails?.length ?? 0;

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

  // ─── Filtres ──────────────────────────────────────────────────────────────
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterImportance, setFilterImportance] = useState<"all" | "important">("all");
  const [crmFilter, setCrmFilter] = useState<CrmFilter>(null);
  const [categoriesCollapsed, setCategoriesCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("ncv.categoriesCollapsed") === "1";
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        "ncv.categoriesCollapsed",
        categoriesCollapsed ? "1" : "0",
      );
    }
  }, [categoriesCollapsed]);

  const { data: integrationsList = [] } = useListIntegrations();
  const integrations = (integrationsList as Integration[]) || [];
  const isEnabled = (i: Integration): boolean =>
    Boolean((i as Integration & { enabled?: boolean }).enabled);
  const hasHubspot = integrations.some(
    (i) => String(i.provider) === "hubspot" && isEnabled(i),
  );
  const hasPipedrive = integrations.some(
    (i) => String(i.provider) === "pipedrive" && isEnabled(i),
  );
  const hasSalesforce = integrations.some(
    (i) => String(i.provider) === "salesforce" && isEnabled(i),
  );
  const hasOdoo = integrations.some(
    (i) => String(i.provider) === "odoo" && isEnabled(i),
  );

  // ─── Helpers UI ───────────────────────────────────────────────────────────
  const tabBaseClass =
    "inline-flex items-center justify-center gap-1 w-[140px] h-7 text-[11px] rounded-md font-medium transition-colors";
  const tabActiveClass = "bg-primary/15 text-primary border border-primary/20";
  const tabIdleClass =
    "text-[#b8c5d6] border border-[#1f2937] hover:text-white hover:border-[#b8c5d6]/30";
  const cls = (active: boolean) =>
    `${tabBaseClass} ${active ? tabActiveClass : tabIdleClass}`;

  const isInbox = currentTab === "inbox";

  return (
    <div className="sticky top-16 z-[5] bg-background pt-4 pb-2.5 border-b border-border">
      {/* Bloc A — recherche + Actualiser + Nouvel email */}
      <div className="flex items-center gap-2 mb-2.5 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8">
        <div className="flex-1 relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8b95a7]" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t("inbox.searchPlaceholder")}
            className="pl-8 pr-16 bg-[#0d1218] border-[#1f2630] text-white placeholder:text-[#8b95a7]/70 h-9 text-[13px] rounded-md"
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
            className={
              isComposeFullscreen
                ? "bg-card border-border w-screen max-w-none h-screen sm:rounded-none p-0 flex flex-col"
                : "bg-card border-border w-[95vw] sm:max-w-3xl p-0 flex flex-col max-h-[90vh]"
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
              />
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Bloc B — onglets boîtes & équipe */}
      <div className="flex flex-wrap items-center gap-1.5 gap-y-2 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 mb-2">
        {isInbox ? (
          <button className={cls(true)} type="button">
            <Inbox className="w-3 h-3" />
            {t("inbox.title")}
            {inboxCountFromApi > 0 && (
              <span className="text-[10px] bg-white/10 text-white px-1.5 py-0.5 rounded-full">
                {inboxCountFromApi}
              </span>
            )}
          </button>
        ) : (
          <Link href="/dashboard" className={cls(false)}>
            <Inbox className="w-3 h-3" />
            {t("inbox.title")}
            {inboxCountFromApi > 0 && (
              <span className="text-[10px] bg-white/10 text-white px-1.5 py-0.5 rounded-full">
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
            <span className="text-[10px] bg-white/10 text-white px-1.5 py-0.5 rounded-full">
              {spamCountFromApi}
            </span>
          )}
        </Link>

        <Link href="/dashboard/corbeille" className={cls(currentTab === "corbeille")}>
          <Trash2 className="w-3 h-3" />
          {t("inbox.trash")}
          {trashCountFromApi > 0 && (
            <span className="text-[10px] bg-white/10 text-white px-1.5 py-0.5 rounded-full">
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
          style={{ flexBasis: "100%", width: "100%", height: 0 }}
        />

        {hasSharedMailboxes && (
          <Link href="/dashboard?mode=shared" className={cls(false)}>
            <Users className="w-3 h-3" />
            {t("inbox.sharedMailboxShort", "Partagées")}
            {sharedMailboxesCount > 0 && (
              <span className="text-[10px] bg-white/10 text-white px-1.5 py-0.5 rounded-full">
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
            {t("inbox.assignedShort", "Assignés")}
            {assignedToMeCount > 0 && (
              <span className="text-[10px] bg-white/10 text-white px-1.5 py-0.5 rounded-full">
                {assignedToMeCount}
              </span>
            )}
          </Link>
        )}

        <Link href="/dashboard/reportes" className={cls(currentTab === "reportes")}>
          <BellOff className="w-3 h-3" />
          {t("sidebar.snoozed", "Reportés")}
          {snoozedCount > 0 && (
            <span className="text-[10px] bg-white/10 text-white px-1.5 py-0.5 rounded-full">
              {snoozedCount}
            </span>
          )}
        </Link>

        <Link href="/dashboard/taches" className={cls(currentTab === "taches")}>
          <CheckSquare className="w-3 h-3" />
          {t("tasks.title")}
          {openTasksCount > 0 && (
            <span className="text-[10px] bg-white/10 text-white px-1.5 py-0.5 rounded-full">
              {openTasksCount}
            </span>
          )}
        </Link>

        <Link href="/dashboard/projets" className={cls(currentTab === "projets")}>
          <FolderKanban className="w-3 h-3" />
          {t("sidebar.projects")}
          {projectsCount > 0 && (
            <span className="text-[10px] bg-white/10 text-white px-1.5 py-0.5 rounded-full">
              {projectsCount}
            </span>
          )}
        </Link>

        <Link href="/dashboard/relances" className={cls(currentTab === "relances")}>
          <MailCheck className="w-3 h-3" />
          {t("sidebar.followups", "Relances")}
          {followupsCount > 0 && (
            <span className="text-[10px] bg-white/10 text-white px-1.5 py-0.5 rounded-full">
              {followupsCount}
            </span>
          )}
        </Link>

        <Link href="/dashboard/archives" className={cls(currentTab === "archives")}>
          <Archive className="w-3 h-3" />
          {t("sidebar.archives")}
          {archivesCount > 0 && (
            <span className="text-[10px] bg-white/10 text-white px-1.5 py-0.5 rounded-full">
              {archivesCount}
            </span>
          )}
        </Link>
      </div>

      {/* Bloc C — Filtres / Catégories */}
      <div
        className="flex flex-wrap items-center gap-2 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8"
        data-testid="row-filters-unified"
      >
        {(() => {
          const activeCount =
            (filterPriority !== "all" ? 1 : 0) +
            (filterImportance !== "all" ? 1 : 0) +
            (crmFilter ? 1 : 0);
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={`inline-flex items-center gap-1.5 h-8 px-3 text-[12px] rounded-md font-medium border transition-colors ${
                    activeCount > 0
                      ? "bg-primary/15 text-primary border-primary/20"
                      : "text-[#b8c5d6] border-[#1f2630] hover:text-white hover:border-[#b8c5d6]/30 bg-transparent"
                  }`}
                  data-testid="btn-filters-unified"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>{t("inbox.filtersLabel", "Filtres")}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64 bg-card border-border">
                <DropdownMenuLabel className="text-[10.5px] uppercase tracking-[0.08em] text-[#8b95a7] font-semibold">
                  {t("inbox.importanceLabel", "Affichage")}
                </DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={filterImportance}
                  onValueChange={(v) => setFilterImportance(v as "all" | "important")}
                >
                  <DropdownMenuRadioItem value="all" className="text-[12px]">
                    {t("inbox.importance.all", "Tous les mails")}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="important" className="text-[12px]">
                    {t("inbox.importance.important", "Importants")}
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>

                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10.5px] uppercase tracking-[0.08em] text-[#8b95a7] font-semibold">
                  {t("inbox.priorityLabel", "Priorité")}
                </DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={filterPriority}
                  onValueChange={setFilterPriority}
                >
                  <DropdownMenuRadioItem value="all" className="text-[12px]">
                    {t("inbox.priorities.all", "Toutes")}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="urgent" className="text-[12px]">
                    {t("inbox.priorities.urgent")}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="moyen" className="text-[12px]">
                    {t("inbox.priorities.medium")}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="faible" className="text-[12px]">
                    {t("inbox.priorities.low")}
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>

                {(hasHubspot || hasPipedrive || hasSalesforce || hasOdoo) && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-[10.5px] uppercase tracking-[0.08em] text-[#8b95a7] font-semibold">
                      CRM
                    </DropdownMenuLabel>
                    {hasHubspot && (
                      <DropdownMenuCheckboxItem
                        checked={crmFilter === "hubspot"}
                        onCheckedChange={(v) => setCrmFilter(v ? "hubspot" : null)}
                        className="text-[12px]"
                      >
                        <Building2 className="w-3 h-3 mr-1.5" />
                        HubSpot
                      </DropdownMenuCheckboxItem>
                    )}
                    {hasPipedrive && (
                      <DropdownMenuCheckboxItem
                        checked={crmFilter === "pipedrive"}
                        onCheckedChange={(v) => setCrmFilter(v ? "pipedrive" : null)}
                        className="text-[12px]"
                      >
                        <Briefcase className="w-3 h-3 mr-1.5" />
                        Pipedrive
                      </DropdownMenuCheckboxItem>
                    )}
                    {hasSalesforce && (
                      <DropdownMenuCheckboxItem
                        checked={crmFilter === "salesforce"}
                        onCheckedChange={(v) => setCrmFilter(v ? "salesforce" : null)}
                        className="text-[12px]"
                      >
                        <Cloud className="w-3 h-3 mr-1.5" />
                        Salesforce
                      </DropdownMenuCheckboxItem>
                    )}
                    {hasOdoo && (
                      <DropdownMenuCheckboxItem
                        checked={crmFilter === "odoo"}
                        onCheckedChange={(v) => setCrmFilter(v ? "odoo" : null)}
                        className="text-[12px]"
                      >
                        <Database className="w-3 h-3 mr-1.5" />
                        Odoo
                      </DropdownMenuCheckboxItem>
                    )}
                  </>
                )}

                {activeCount > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => {
                        setFilterPriority("all");
                        setFilterImportance("all");
                        setCrmFilter(null);
                      }}
                      className="text-[12px] text-[#b8c5d6]"
                    >
                      <X className="w-3 h-3 mr-1.5" />
                      {t("inbox.filtersReset", "Réinitialiser les filtres")}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        })()}

        <span className="inline-flex items-center gap-1 h-7 px-2 text-[11px] rounded-md bg-primary/15 text-primary border border-primary/20">
          {filterImportance === "important"
            ? t("inbox.importance.important", "Importants")
            : t("inbox.importance.all", "Tous")}
        </span>
        <span className="inline-flex items-center gap-1 h-7 px-2 text-[11px] rounded-md bg-primary/15 text-primary border border-primary/20">
          {filterPriority === "urgent"
            ? t("inbox.priorities.urgent")
            : filterPriority === "moyen"
              ? t("inbox.priorities.medium")
              : filterPriority === "faible"
                ? t("inbox.priorities.low")
                : t("inbox.priorities.all", "Toutes")}
        </span>

        <button
          type="button"
          onClick={() => setCategoriesCollapsed((v) => !v)}
          className={`inline-flex items-center gap-1 h-7 px-2 text-[11px] rounded-md font-medium border transition-colors ${
            categoriesCollapsed
              ? "text-[#b8c5d6] border-[#1f2630] hover:text-white hover:border-[#b8c5d6]/30 bg-transparent"
              : "bg-primary/15 text-primary border-primary/20"
          }`}
          title={
            categoriesCollapsed
              ? t("common.expand", { defaultValue: "Afficher les catégories" })
              : t("common.collapse", { defaultValue: "Masquer les catégories" })
          }
        >
          <Tags className="w-3.5 h-3.5" />
          <span>{t("inbox.category")}</span>
          {categoriesCollapsed ? (
            <ChevronRight className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </button>

        {crmFilter && (
          <button
            onClick={() => setCrmFilter(null)}
            className="inline-flex items-center gap-1 h-7 px-2 text-[11px] rounded-md bg-primary/15 text-primary border border-primary/20"
          >
            {crmFilter === "hubspot" ? (
              <Building2 className="w-3 h-3" />
            ) : crmFilter === "pipedrive" ? (
              <Briefcase className="w-3 h-3" />
            ) : crmFilter === "salesforce" ? (
              <Cloud className="w-3 h-3" />
            ) : (
              <Database className="w-3 h-3" />
            )}
            {crmFilter === "hubspot"
              ? "HubSpot"
              : crmFilter === "pipedrive"
                ? "Pipedrive"
                : crmFilter === "salesforce"
                  ? "Salesforce"
                  : "Odoo"}
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}
