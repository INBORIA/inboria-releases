import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useMarkInboxPage } from "@/lib/inbox-theme";
import { BackToInboxButton } from "@/components/dashboard/back-to-inbox-button";
import { extractEmailAddress } from "@/lib/utils";
import { EmailBodyRenderer } from "@/components/EmailBodyRenderer";
import { EmailComments } from "@/components/email-comments";
import { TaskAssigneePicker } from "@/components/task-assignee-picker";
import { AttachmentList, AttachmentBadge } from "@/components/AttachmentList";
import { FileAttachInput, type UploadedFile } from "@/components/FileAttachInput";
import { TemplateSuggestionBar } from "@/components/templates/template-suggestion-bar";
import { SignatureEditor } from "@/components/signature/signature-editor";
import { SaveAsTemplateButton } from "@/components/templates/save-as-template-button";
import {
  useListEmails,
  useGetCategoryCounts,
  useUpdateEmail,
  useDeleteEmail,
  useSendEmail,
  useCancelPendingSend,
  useGenerateDraft,
  getListEmailsQueryKey,
  useGetDashboardSummary,
  getGetDashboardSummaryQueryKey,
  getGetCategoryCountsQueryKey,
  getGetInboxHealthQueryKey,
  useListProjects,
  useGetProfile,
  useRecategorizeUncategorized,
  useBulkUpdateEmails,
  useGetMyOrganisation,
  useGetOrganisationMembers,
  useAssignEmail,
  useUnassignEmail,
  useGetSharedMailboxes,
  useGetSharedMailboxEmails,
  useClaimSharedEmail,
  useSuggestTemplates,
  useCreateTemplateFromEmail,
  useUnclaimSharedEmail,
  useCreateTask,
  getListTasksQueryKey,
  useRestoreEmail,
  usePermanentDeleteEmail,
  useEmptyTrash,
  useBlockSender,
  useListIntegrations,
  useGetDashboardBootstrap,
  getGetMyOrganisationQueryKey,
  getGetOrganisationMembersQueryKey,
  getGetSharedMailboxesQueryKey,
  getListProjectsQueryKey,
  getListIntegrationsQueryKey,
} from "@workspace/api-client-react";
import type { Email, PaginatedEmails, PaginatedSharedMailboxEmails, Integration } from "@workspace/api-client-react";
import { getGetProfileQueryKey } from "@workspace/api-client-react";
import { useTranslation } from 'react-i18next';
import { translateCategoryName } from "@/lib/category-translations";
import { format } from "date-fns";
import { fr, enUS, nl, de, es, it, pt, pl, ro, sv, da, fi, hu, cs, tr, ja, ko, vi, th, id, ms, el } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Clock, CheckCircle2, Sparkles, Inbox, ArrowLeft, Reply, Forward, Archive, X, ChevronRight, Trash2, RefreshCw, Search, PenSquare, Send, Wand2, Loader2, Zap, CheckCircle, Tags, Check, CheckSquare, Square, UserPlus, UserCheck, UserX, Users, Hand, HandMetal, ListTodo, CalendarDays, Download, ShieldAlert, ArrowUpDown, ArrowDown, ArrowUp, Maximize2, Minimize2, AlertCircle, Building2, Briefcase, Cloud, Database } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Link, useLocation } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import SnoozeButton from "@/components/wave1/SnoozeButton";
import ScheduleSendDialog from "@/components/wave1/ScheduleSendDialog";
import { Eye } from "lucide-react";
import { resolveMailboxBadge, recipientMatchesAddress, type MailboxBadge } from "@/lib/mailbox-resolver";
import { EmailDetail } from "@/components/email-detail/EmailDetail";
import { PriorityBadge, PRIORITY_BAR_COLORS } from "@/components/email-detail/helpers";

function EmailRow({ email, onClick, onArchive, onDelete, onCategoryClick, isSelected, onToggleSelect, selectionMode, onContextMenu, onDragSelectStart, mailboxBadge, showMailboxBadge, isSlaBreach }: { email: any; onClick: () => void; onArchive: (id: number) => void; onDelete: (id: number) => void; onCategoryClick?: (name: string) => void; isSelected: boolean; onToggleSelect: (id: number) => void; selectionMode: boolean; onContextMenu?: (e: React.MouseEvent, emailId: number) => void; onDragSelectStart?: (id: number) => void; mailboxBadge?: MailboxBadge | null; showMailboxBadge?: boolean; isSlaBreach?: boolean }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? i18n.language.split("-")[0];
  const dateFnsLocale = ({fr,en:enUS,nl,de,es,it,pt,pl}[(i18n.resolvedLanguage || i18n.language || "fr").substring(0,2)] || fr);
  const [rowLocation] = useLocation();
  const isClassicMirror = rowLocation.includes("inbox-classic");
  const barColor = PRIORITY_BAR_COLORS[(email.priority || "faible") as keyof typeof PRIORITY_BAR_COLORS] || PRIORITY_BAR_COLORS.faible;

  return (
    <div
      data-email-row
      data-row-id={email.id}
      className={`group flex items-stretch rounded-lg border bg-card hover:bg-[#1a2235] transition-colors cursor-pointer overflow-hidden select-none ${isSelected ? "border-primary/50 bg-primary/[0.06]" : isSlaBreach ? "border-red-500/40" : "border-border"}`}
      onClick={onClick}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(e, email.id); }}
      onMouseDown={(e) => { if (e.button === 0) { e.preventDefault(); onDragSelectStart?.(email.id); } }}
    >
      <div className={isClassicMirror ? `w-1 shrink-0 ${barColor}` : `w-0 shrink-0 hidden ${barColor}`} />
      <div className="flex items-center gap-2 flex-1 min-w-0 p-3">
        <button
          className="w-5 h-5 rounded flex items-center justify-center shrink-0 transition-all cursor-pointer border border-[#2a3441] hover:border-primary select-none"
          onClick={(e) => { e.stopPropagation(); onToggleSelect(email.id); }}
          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); onDragSelectStart?.(email.id); }}
        >
          {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
        </button>
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
          <span className="text-primary font-semibold text-[12px]">{(email.sender || "?")[0].toUpperCase()}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[12px] truncate font-semibold text-white">{email.sender}</span>
          </div>
          <h3 className="text-[12px] truncate text-white/80">{email.subject}</h3>
          {email.summary && (
            <div className="flex items-center gap-1 mt-0.5">
              <Sparkles className="w-3 h-3 text-primary shrink-0" />
              <p className="text-[11px] text-[#b8c5d6] line-clamp-1">{email.summary}</p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 self-center">
          {email.projectReference && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-purple-500/15 text-purple-400 border border-purple-500/20 hidden sm:inline-flex">
              {email.projectReference}
            </span>
          )}
          {(email.attachmentCount ?? 0) > 0 && (
            <AttachmentBadge count={email.attachmentCount} />
          )}
          {(email.taskCount ?? 0) > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-violet-500/15 text-violet-400 border border-violet-500/20 inline-flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              {email.taskCount} {email.taskCount === 1 ? t("inbox.taskBadgeSingular") : t("inbox.taskBadgePlural")}
            </span>
          )}
          {email.assignedTo && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 hidden sm:inline-flex items-center gap-1">
              <UserPlus className="w-2.5 h-2.5" />
              {t("inbox.assignedBadge")}
            </span>
          )}
          {isSlaBreach && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-red-500/15 text-red-400 border border-red-500/30 inline-flex items-center gap-1"
              title={t("inbox.slaOverdue", { defaultValue: "SLA overdue" })}
            >
              <AlertCircle className="w-2.5 h-2.5" />
              SLA
            </span>
          )}
          <PriorityBadge priority={(email.priority || "faible") as any} />
          <span className="text-[10px] text-[#b8c5d6] whitespace-nowrap items-center gap-1 hidden sm:flex">
            <Clock className="w-3 h-3" />
            {format(new Date(email.createdAt), "d MMM HH:mm", { locale: dateFnsLocale })}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onArchive(email.id); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-white/[0.08] text-[#b8c5d6] hover:text-white"
            title={t("inbox.archive")}
          >
            <Archive className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(email.id); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-red-500/[0.08] text-[#b8c5d6] hover:text-red-400"
            title={t("inbox.deleteEmail")}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-[#b8c5d6]/40 group-hover:text-[#b8c5d6] transition-colors" />
        </div>
      </div>
    </div>
  );
}

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

type InboxMode = "personal" | "shared";

type ComposeConnection = { id: string; provider: string; email_address: string; signature?: string | null };
type ComposeSendPayload = {
  to: string;
  subject: string;
  body: string;
  attachments: UploadedFile[];
  connectionId: string;
  projectId: string;
};

const ComposeDialogBody = memo(function ComposeDialogBody({
  isFullscreen,
  setIsFullscreen,
  connections,
  projects,
  isPending,
  onSend,
  initialTo = "",
  initialSubject = "",
  initialBody = "",
}: {
  isFullscreen: boolean;
  setIsFullscreen: (v: boolean | ((p: boolean) => boolean)) => void;
  connections: ComposeConnection[];
  projects: any[];
  isPending: boolean;
  onSend: (p: ComposeSendPayload) => void;
  initialTo?: string;
  initialSubject?: string;
  initialBody?: string;
}) {
  const { t } = useTranslation();
  const [to, setTo] = useState(initialTo);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [attachments, setAttachments] = useState<UploadedFile[]>([]);
  const [fromId, setFromId] = useState<string>(() => (connections[0] ? String(connections[0].id) : ""));
  const [projectId, setProjectId] = useState<string>("");
  const [appliedSig, setAppliedSig] = useState<string>(initialBody ? "__prefilled__" : "");

  const computeSig = useCallback((connId: string) => {
    const c = connections.find((x) => String(x.id) === String(connId));
    return (c?.signature || "").trim();
  }, [connections]);

  useEffect(() => {
    if (!fromId && connections[0]) setFromId(String(connections[0].id));
  }, [connections, fromId]);

  useEffect(() => {
    if (!fromId) return;
    const newSig = computeSig(fromId);
    setBody((prev) => {
      let base = prev || "";
      if (appliedSig) {
        const oldBlock = `\n\n-- \n${appliedSig}`;
        const idx = base.lastIndexOf(oldBlock);
        if (idx !== -1) base = base.slice(0, idx) + base.slice(idx + oldBlock.length);
      }
      if (newSig) base = `${base.replace(/\s+$/, "")}\n\n-- \n${newSig}`;
      return base;
    });
    setAppliedSig(newSig);
  }, [fromId, computeSig]);

  return (
    <>
      <DialogHeader className="px-5 pt-4 pb-2 pr-12 flex-row items-center justify-between gap-2 space-y-0 border-b border-border">
        <DialogTitle className="text-white text-[14px]">{t("inbox.composeTitle")}</DialogTitle>
        <button
          type="button"
          onClick={() => setIsFullscreen((v: boolean) => !v)}
          className="text-[#b8c5d6] hover:text-white p-1 rounded hover:bg-white/[0.04] mr-2"
          aria-label={isFullscreen ? t("inbox.exitFullscreen", "Quitter plein écran") : t("inbox.fullscreen", "Plein écran")}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </DialogHeader>
      <div className="space-y-3 p-5 overflow-y-auto flex-1">
        {connections.length > 1 && (
          <div>
            <label className="text-[11px] text-[#b8c5d6] mb-1 block">{t("inbox.from", "De")}</label>
            <Select value={fromId} onValueChange={setFromId}>
              <SelectTrigger className="bg-background border-border text-white text-[12px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {connections.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.email_address}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div>
          <label className="text-[11px] text-[#b8c5d6] mb-1 block">{t("inbox.to")}</label>
          <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="email@exemple.com" className="bg-background border-border text-white text-[12px] h-8" />
        </div>
        <div>
          <label className="text-[11px] text-[#b8c5d6] mb-1 block">{t("inbox.subject")}</label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t("inbox.subject")} className="bg-background border-border text-white text-[12px] h-8" />
        </div>
        {projects && projects.length > 0 && (
          <div>
            <label className="text-[11px] text-[#b8c5d6] mb-1 block">{t("inbox.project")}</label>
            <Select value={projectId || "__none__"} onValueChange={(v) => setProjectId(v === "__none__" ? "" : v)}>
              <SelectTrigger className="bg-background border-border text-white text-[12px] h-8">
                <SelectValue placeholder={t("inbox.noProject")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("inbox.noProject")}</SelectItem>
                {projects.map((p: any) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex flex-col flex-1 min-h-0">
          <label className="text-[11px] text-[#b8c5d6] mb-1 block">{t("inbox.message")}</label>
          <SignatureEditor
            value={body}
            onChange={setBody}
            placeholder={t("inbox.message")}
            hideHint
            minHeight={isFullscreen ? 300 : 260}
          />
        </div>
        <FileAttachInput files={attachments} onChange={setAttachments} />
      </div>
      <div className="border-t border-border p-4">
        <Button
          className="w-full gap-2 h-9 text-[12px]"
          disabled={isPending || !to.trim() || !subject.trim() || !body.trim()}
          onClick={() => onSend({ to, subject, body, attachments, connectionId: fromId, projectId })}
        >
          <Send className="w-3.5 h-3.5" />
          {isPending ? t("inbox.sending") : t("inbox.send")}
        </Button>
      </div>
    </>
  );
});

// Wave HubSpot — panneau latéral "Cockpit HubSpot" (Orientation 3).
// Affiche la fiche du contact correspondant à l'expéditeur de l'email sélectionné :
// nom, société, poste, owner, lifecycle, deals, dernière interaction.
// Inclut la barre d'actions cockpit : logger l'email, créer un deal préfilled,
// créer une tâche, faire avancer la phase d'un deal, changer le lifecycle/lead status.
// Repliable en bande verticale étroite via le bouton Minimize2.
type HubspotContext = {
  contact: {
    externalId: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    company: string | null;
    phone: string | null;
    jobTitle: string | null;
    lifecycleStage: string | null;
    leadStatus: string | null;
    ownerId: string | null;
    lastContactedAt: string | null;
    lastSyncedAt: string;
  };
  deals: Array<{
    externalId: string;
    title: string | null;
    amount: number | null;
    currency: string | null;
    stage: string | null;
    status: string | null;
    closeDate: string | null;
  }>;
};

type HubspotPipelinesResponse = {
  pipelines: Array<{
    id: string;
    label: string;
    stages: Array<{ id: string; label: string; displayOrder: number }>;
  }>;
};

// Wave Pipedrive — Cockpit (parité HubSpot). Forme miroir : pas de
// jobTitle/lifecycle/leadStatus (Pipedrive n'a pas ces champs natifs),
// remplacés par `label` (catégorie libre côté Person Pipedrive).
type PipedriveContext = {
  contact: {
    externalId: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    company: string | null;
    phone: string | null;
    label: string | null;
    ownerId: string | null;
    ownerName: string | null;
    lastSyncedAt: string;
  };
  deals: Array<{
    externalId: string;
    title: string | null;
    amount: number | null;
    currency: string | null;
    stage: string | null;
    status: string | null;
    closeDate: string | null;
  }>;
  activities: Array<{
    id: string;
    type: string | null;
    subject: string | null;
    dueDate: string | null;
    done: boolean;
    addTime: string | null;
  }>;
};

type PipedrivePipelinesResponse = {
  pipelines: Array<{
    id: string;
    label: string;
    stages: Array<{ id: string; label: string; displayOrder: number }>;
  }>;
};

// Salesforce context — parité PipedriveContext mais avec champs Salesforce :
// `description` (texte libre éditable, équivalent du label Pipedrive) et
// `tasks` (Activities Salesforce, équivalent activities Pipedrive).
type SalesforceContext = {
  contact: {
    externalId: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    company: string | null;
    phone: string | null;
    jobTitle: string | null;
    description: string | null;
    leadSource: string | null;
    ownerId: string | null;
    ownerName: string | null;
    lastSyncedAt: string;
  };
  deals: Array<{
    externalId: string;
    title: string | null;
    amount: number | null;
    currency: string | null;
    stage: string | null;
    status: string | null;
    closeDate: string | null;
  }>;
  tasks: Array<{
    id: string;
    subject: string | null;
    status: string | null;
    activityDate: string | null;
    isClosed: boolean;
    createdDate: string | null;
  }>;
};

type SalesforcePipelinesResponse = {
  pipelines: Array<{
    id: string;
    label: string;
    stages: Array<{ id: string; label: string; displayOrder: number }>;
  }>;
};

const HUBSPOT_LIFECYCLE_OPTIONS = [
  "subscriber",
  "lead",
  "marketingqualifiedlead",
  "salesqualifiedlead",
  "opportunity",
  "customer",
  "evangelist",
  "other",
];
const HUBSPOT_LEAD_STATUS_OPTIONS = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "OPEN_DEAL",
  "UNQUALIFIED",
  "ATTEMPTED_TO_CONTACT",
  "CONNECTED",
  "BAD_TIMING",
];

async function authedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const { supabase } = await import("@/lib/supabase");
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  return fetch(url, {
    ...init,
    headers: {
      ...(init.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });
}

function HubspotContextPanel({
  senderEmail,
  selectedEmailId,
  selectedSubject,
  selectedBody,
  selectedDate,
  collapsed,
  onToggleCollapsed,
  onHide,
}: {
  senderEmail: string | null;
  selectedEmailId: number | null;
  selectedSubject: string | null;
  selectedBody: string | null;
  selectedDate: string | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onHide: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const apiBase = `${import.meta.env.BASE_URL}api`;

  const { data: ctx, isLoading, isError } = useQuery({
    queryKey: ["hubspot-contact-context", senderEmail],
    enabled: !!senderEmail && !collapsed,
    queryFn: async (): Promise<HubspotContext | null> => {
      const res = await authedFetch(`${apiBase}/integrations/hubspot/contact-context?email=${encodeURIComponent(senderEmail!)}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("failed");
      return res.json() as Promise<HubspotContext>;
    },
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  // Chargement paresseux des pipelines (uniquement si on a un contact ET qu'au
  // moins un deal existe, ou si l'utilisateur ouvre le formulaire "Créer deal").
  const [pipelinesEnabled, setPipelinesEnabled] = useState(false);
  useEffect(() => {
    if (ctx && ctx.deals.length > 0) setPipelinesEnabled(true);
  }, [ctx]);
  const { data: pipelinesData } = useQuery({
    queryKey: ["hubspot-pipelines"],
    enabled: pipelinesEnabled && !collapsed,
    queryFn: async (): Promise<HubspotPipelinesResponse> => {
      const res = await authedFetch(`${apiBase}/integrations/hubspot/pipelines`);
      if (!res.ok) throw new Error("failed");
      return res.json() as Promise<HubspotPipelinesResponse>;
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const allStages = (pipelinesData?.pipelines || []).flatMap((p) =>
    p.stages.map((s) => ({ pipelineId: p.id, pipelineLabel: p.label, ...s })),
  );
  const defaultPipeline = pipelinesData?.pipelines?.[0];
  const defaultStage = defaultPipeline?.stages?.[0];

  // Mutations cockpit
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["hubspot-contact-context", senderEmail] });
  };
  const logEmailMut = useMutation({
    mutationFn: async () => {
      const res = await authedFetch(`${apiBase}/integrations/hubspot/log-email`, {
        method: "POST",
        body: JSON.stringify({
          contactExternalId: ctx?.contact?.externalId,
          emailId: selectedEmailId,
          subject: selectedSubject,
          body: selectedBody,
          occurredAt: selectedDate,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "log failed");
      return res.json();
    },
    onSuccess: (data: { alreadyLogged?: boolean }) => {
      toast({
        title: data.alreadyLogged ? t("inbox.crmActionAlreadyLogged") : t("inbox.crmActionLogEmailDone"),
      });
    },
    onError: (err: Error) => {
      toast({ title: t("inbox.crmActionError"), description: err.message, variant: "destructive" });
    },
  });
  const createDealMut = useMutation({
    mutationFn: async (input: {
      dealname: string;
      amount: string;
      pipeline: string;
      dealstage: string;
      closedate: string;
    }) => {
      const res = await authedFetch(`${apiBase}/integrations/hubspot/create-deal`, {
        method: "POST",
        body: JSON.stringify({
          contactExternalId: ctx?.contact?.externalId,
          dealname: input.dealname,
          amount: input.amount ? Number(input.amount) : null,
          pipeline: input.pipeline || null,
          dealstage: input.dealstage || null,
          closedate: input.closedate || null,
        }),
      });
      if (!res.ok) {
        // Récupère le hint du backend pour afficher un message ciblé
        // (reconnexion HubSpot vs erreur de validation pipeline/stage).
        const body = await res.json().catch(() => ({} as { error?: string; hint?: string }));
        const err = new Error(body.error || "create deal failed") as Error & { hint?: string };
        err.hint = body.hint;
        throw err;
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("inbox.crmActionDealCreated") });
      setShowDealForm(false);
      refresh();
    },
    onError: (err: Error & { hint?: string }) => {
      // Hint "reconnect_hubspot" → message clair et actionnable plutôt
      // que l'erreur brute "HubSpot API 403: ...".
      const description = err.hint === "reconnect_hubspot" ? t("inbox.crmActionErrorReconnect") : err.message;
      toast({ title: t("inbox.crmActionError"), description, variant: "destructive" });
    },
  });
  const createTaskMut = useMutation({
    mutationFn: async (input: { subject: string; body: string; dueAt: string }) => {
      const res = await authedFetch(`${apiBase}/integrations/hubspot/create-task`, {
        method: "POST",
        body: JSON.stringify({
          contactExternalId: ctx?.contact?.externalId,
          subject: input.subject,
          body: input.body,
          dueAt: input.dueAt || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "create task failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("inbox.crmActionTaskCreated") });
      setShowTaskForm(false);
    },
    onError: (err: Error) => {
      toast({ title: t("inbox.crmActionError"), description: err.message, variant: "destructive" });
    },
  });
  const updateDealStageMut = useMutation({
    mutationFn: async (input: { dealExternalId: string; dealstage: string }) => {
      const res = await authedFetch(`${apiBase}/integrations/hubspot/deals/${encodeURIComponent(input.dealExternalId)}`, {
        method: "PATCH",
        body: JSON.stringify({ dealstage: input.dealstage }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "update deal failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("inbox.crmActionDealStageUpdated") });
      refresh();
    },
    onError: (err: Error) => {
      toast({ title: t("inbox.crmActionError"), description: err.message, variant: "destructive" });
    },
  });
  const updateContactPropsMut = useMutation({
    mutationFn: async (input: { lifecycleStage?: string; leadStatus?: string }) => {
      if (!ctx?.contact?.externalId) throw new Error("no contact");
      const res = await authedFetch(`${apiBase}/integrations/hubspot/contacts/${encodeURIComponent(ctx.contact.externalId)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "update contact failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("inbox.crmActionContactUpdated") });
      refresh();
    },
    onError: (err: Error) => {
      toast({ title: t("inbox.crmActionError"), description: err.message, variant: "destructive" });
    },
  });

  // Forms state
  const [showDealForm, setShowDealForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [dealName, setDealName] = useState("");
  const [dealAmount, setDealAmount] = useState("");
  const [dealPipeline, setDealPipeline] = useState("");
  const [dealStage, setDealStage] = useState("");
  const [dealClose, setDealClose] = useState("");
  const [taskSubject, setTaskSubject] = useState("");
  const [taskBody, setTaskBody] = useState("");
  const [taskDue, setTaskDue] = useState("");

  // Quand on ouvre le form Deal, préremplir avec l'email sélectionné.
  useEffect(() => {
    if (showDealForm) {
      setPipelinesEnabled(true);
      if (!dealName && selectedSubject) setDealName(selectedSubject.slice(0, 80));
      if (!dealClose) {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        setDealClose(d.toISOString().slice(0, 10));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDealForm]);
  useEffect(() => {
    if (showDealForm && defaultPipeline && !dealPipeline) setDealPipeline(defaultPipeline.id);
    if (showDealForm && defaultStage && !dealStage) setDealStage(defaultStage.id);
  }, [showDealForm, defaultPipeline, defaultStage, dealPipeline, dealStage]);
  useEffect(() => {
    if (showTaskForm) {
      if (!taskSubject) setTaskSubject(selectedSubject ? `Suivi : ${selectedSubject.slice(0, 80)}` : t("inbox.crmActionTaskDefaultTitle"));
      if (!taskDue) {
        const d = new Date();
        d.setDate(d.getDate() + 7);
        setTaskDue(d.toISOString().slice(0, 10));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTaskForm]);

  if (collapsed) {
    return (
      <div
        className="bg-card rounded-lg border border-primary/30 p-2 flex flex-col items-center gap-2"
        data-testid="panel-hubspot-context-collapsed"
      >
        <Building2 className="w-3.5 h-3.5 text-primary" />
        <button
          onClick={onToggleCollapsed}
          title={t("inbox.crmExpand")}
          className="text-[#b8c5d6] hover:text-white"
          data-testid="button-hubspot-expand"
        >
          <Maximize2 className="w-3 h-3" />
        </button>
      </div>
    );
  }

  const fullName =
    [ctx?.contact?.firstName, ctx?.contact?.lastName].filter(Boolean).join(" ") ||
    ctx?.contact?.email ||
    senderEmail ||
    "—";
  const initials = ((ctx?.contact?.firstName?.[0] ?? "") + (ctx?.contact?.lastName?.[0] ?? "")).toUpperCase()
    || (senderEmail?.[0] ?? "?").toUpperCase();

  return (
    <div
      className="bg-card rounded-lg border border-primary/30 p-3 space-y-2"
      data-testid="panel-hubspot-context"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-medium text-primary uppercase tracking-wider flex items-center gap-1.5">
          <Building2 className="w-3 h-3" />
          {t("inbox.crmHubspotPanelTitle")}
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleCollapsed}
            title={t("inbox.crmCollapse")}
            className="text-[#b8c5d6] hover:text-white"
            data-testid="button-hubspot-collapse"
          >
            <Minimize2 className="w-3 h-3" />
          </button>
          <button
            onClick={onHide}
            title={t("inbox.crmHide")}
            className="text-[#b8c5d6] hover:text-white"
            data-testid="button-hubspot-hide"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {!senderEmail && (
        <p className="text-[10px] text-[#b8c5d6] leading-relaxed">
          {t("inbox.crmSelectEmailHint")}
        </p>
      )}

      {senderEmail && isLoading && (
        <p className="text-[10px] text-[#b8c5d6]">…</p>
      )}

      {senderEmail && !isLoading && (ctx === null || isError) && (
        <p className="text-[10px] text-[#b8c5d6] leading-relaxed" data-testid="text-hubspot-no-match">
          {t("inbox.crmNoMatch")}
        </p>
      )}

      {senderEmail && ctx && (
        <>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-medium shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-[12px] text-white font-medium truncate" data-testid="text-hubspot-contact-name">{fullName}</p>
              {ctx.contact.email && (
                <p className="text-[10px] text-[#b8c5d6] truncate">{ctx.contact.email}</p>
              )}
            </div>
          </div>

          {/* Cockpit Orientation 3 — barre d'actions */}
          <div className="grid grid-cols-3 gap-1 pt-1">
            <button
              type="button"
              onClick={() => logEmailMut.mutate()}
              disabled={!selectedEmailId || logEmailMut.isPending}
              title={t("inbox.crmActionLogEmail")}
              className="text-[10px] bg-primary/10 hover:bg-primary/20 disabled:opacity-40 text-primary rounded px-1.5 py-1 flex items-center justify-center"
              data-testid="button-hubspot-log-email"
            >
              {logEmailMut.isPending ? "…" : t("inbox.crmActionLogEmailShort")}
            </button>
            <button
              type="button"
              onClick={() => { setShowDealForm((v) => !v); setShowTaskForm(false); }}
              className={`text-[10px] rounded px-1.5 py-1 ${showDealForm ? "bg-primary text-white" : "bg-primary/10 hover:bg-primary/20 text-primary"}`}
              data-testid="button-hubspot-toggle-deal-form"
            >
              {t("inbox.crmActionCreateDealShort")}
            </button>
            <button
              type="button"
              onClick={() => { setShowTaskForm((v) => !v); setShowDealForm(false); }}
              className={`text-[10px] rounded px-1.5 py-1 ${showTaskForm ? "bg-primary text-white" : "bg-primary/10 hover:bg-primary/20 text-primary"}`}
              data-testid="button-hubspot-toggle-task-form"
            >
              {t("inbox.crmActionCreateTaskShort")}
            </button>
          </div>

          {/* Formulaire création deal préfilled */}
          {showDealForm && (
            <div className="space-y-1.5 bg-[#0f1729] rounded p-2" data-testid="form-hubspot-deal">
              <input
                type="text"
                value={dealName}
                onChange={(e) => setDealName(e.target.value)}
                placeholder={t("inbox.crmActionDealName")}
                className="w-full text-[10px] bg-[#0a0f1c] border border-[#1f2937] rounded px-1.5 py-1 text-white"
                data-testid="input-hubspot-deal-name"
              />
              <input
                type="number"
                value={dealAmount}
                onChange={(e) => setDealAmount(e.target.value)}
                placeholder={t("inbox.crmActionDealAmount")}
                className="w-full text-[10px] bg-[#0a0f1c] border border-[#1f2937] rounded px-1.5 py-1 text-white"
                data-testid="input-hubspot-deal-amount"
              />
              {allStages.length > 0 && (
                <select
                  value={dealStage}
                  onChange={(e) => {
                    setDealStage(e.target.value);
                    const found = allStages.find((s) => s.id === e.target.value);
                    if (found) setDealPipeline(found.pipelineId);
                  }}
                  className="w-full text-[10px] bg-[#0a0f1c] border border-[#1f2937] rounded px-1.5 py-1 text-white"
                  data-testid="select-hubspot-deal-stage"
                >
                  {allStages.map((s) => (
                    <option key={`${s.pipelineId}:${s.id}`} value={s.id}>
                      {s.pipelineLabel} — {s.label}
                    </option>
                  ))}
                </select>
              )}
              <input
                type="date"
                value={dealClose}
                onChange={(e) => setDealClose(e.target.value)}
                className="w-full text-[10px] bg-[#0a0f1c] border border-[#1f2937] rounded px-1.5 py-1 text-white"
                data-testid="input-hubspot-deal-close"
              />
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => createDealMut.mutate({ dealname: dealName, amount: dealAmount, pipeline: dealPipeline, dealstage: dealStage, closedate: dealClose })}
                  disabled={!dealName.trim() || createDealMut.isPending}
                  className="flex-1 text-[10px] bg-primary hover:bg-primary/90 disabled:opacity-40 text-white rounded px-1.5 py-1"
                  data-testid="button-hubspot-deal-submit"
                >
                  {createDealMut.isPending ? "…" : t("inbox.crmActionSubmit")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDealForm(false)}
                  className="text-[10px] text-[#b8c5d6] hover:text-white px-1.5"
                >
                  {t("inbox.crmActionCancel")}
                </button>
              </div>
            </div>
          )}

          {/* Formulaire création tâche préfilled */}
          {showTaskForm && (
            <div className="space-y-1.5 bg-[#0f1729] rounded p-2" data-testid="form-hubspot-task">
              <input
                type="text"
                value={taskSubject}
                onChange={(e) => setTaskSubject(e.target.value)}
                placeholder={t("inbox.crmActionTaskTitle")}
                className="w-full text-[10px] bg-[#0a0f1c] border border-[#1f2937] rounded px-1.5 py-1 text-white"
                data-testid="input-hubspot-task-subject"
              />
              <textarea
                value={taskBody}
                onChange={(e) => setTaskBody(e.target.value)}
                placeholder={t("inbox.crmActionTaskNote")}
                rows={2}
                className="w-full text-[10px] bg-[#0a0f1c] border border-[#1f2937] rounded px-1.5 py-1 text-white resize-none"
                data-testid="textarea-hubspot-task-body"
              />
              <input
                type="date"
                value={taskDue}
                onChange={(e) => setTaskDue(e.target.value)}
                className="w-full text-[10px] bg-[#0a0f1c] border border-[#1f2937] rounded px-1.5 py-1 text-white"
                data-testid="input-hubspot-task-due"
              />
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => createTaskMut.mutate({ subject: taskSubject, body: taskBody, dueAt: taskDue })}
                  disabled={!taskSubject.trim() || createTaskMut.isPending}
                  className="flex-1 text-[10px] bg-primary hover:bg-primary/90 disabled:opacity-40 text-white rounded px-1.5 py-1"
                  data-testid="button-hubspot-task-submit"
                >
                  {createTaskMut.isPending ? "…" : t("inbox.crmActionSubmit")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowTaskForm(false)}
                  className="text-[10px] text-[#b8c5d6] hover:text-white px-1.5"
                >
                  {t("inbox.crmActionCancel")}
                </button>
              </div>
            </div>
          )}

          {ctx.contact.company && (
            <div className="text-[11px]">
              <div className="text-[#b8c5d6] text-[10px]">{t("inbox.crmCompany")}</div>
              <div className="text-white">{ctx.contact.company}</div>
            </div>
          )}
          {ctx.contact.jobTitle && (
            <div className="text-[11px]">
              <div className="text-[#b8c5d6] text-[10px]">{t("inbox.crmJobTitle")}</div>
              <div className="text-white">{ctx.contact.jobTitle}</div>
            </div>
          )}
          {ctx.contact.ownerId && (
            <div className="text-[11px]">
              <div className="text-[#b8c5d6] text-[10px]">{t("inbox.crmOwner")}</div>
              <div className="text-white">{ctx.contact.ownerId}</div>
            </div>
          )}

          {/* Lifecycle stage éditable (PATCH HubSpot) */}
          <div className="text-[11px]">
            <div className="text-[#b8c5d6] text-[10px]">{t("inbox.crmLifecycle")}</div>
            <select
              value={ctx.contact.lifecycleStage || ""}
              onChange={(e) => updateContactPropsMut.mutate({ lifecycleStage: e.target.value })}
              disabled={updateContactPropsMut.isPending}
              className="w-full text-[10px] bg-[#0f1729] border border-[#1f2937] rounded px-1.5 py-1 text-white capitalize"
              data-testid="select-hubspot-lifecycle"
            >
              <option value="">—</option>
              {HUBSPOT_LIFECYCLE_OPTIONS.map((o) => (
                <option key={o} value={o} className="capitalize">{o}</option>
              ))}
            </select>
          </div>

          {/* Lead status éditable (PATCH HubSpot) */}
          <div className="text-[11px]">
            <div className="text-[#b8c5d6] text-[10px]">{t("inbox.crmLeadStatus")}</div>
            <select
              value={ctx.contact.leadStatus || ""}
              onChange={(e) => updateContactPropsMut.mutate({ leadStatus: e.target.value })}
              disabled={updateContactPropsMut.isPending}
              className="w-full text-[10px] bg-[#0f1729] border border-[#1f2937] rounded px-1.5 py-1 text-white"
              data-testid="select-hubspot-lead-status"
            >
              <option value="">—</option>
              {HUBSPOT_LEAD_STATUS_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>

          {ctx.contact.lastContactedAt && (
            <div className="text-[11px]">
              <div className="text-[#b8c5d6] text-[10px]">{t("inbox.crmLastInteraction")}</div>
              <div className="text-white">
                {new Date(ctx.contact.lastContactedAt).toLocaleDateString()}
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-[#1f2937]">
            <div className="text-[#b8c5d6] text-[10px] uppercase tracking-wider mb-1.5">
              {t("inbox.crmDealsTitle")}
            </div>
            {ctx.deals.length === 0 ? (
              <p className="text-[10px] text-[#b8c5d6]">{t("inbox.crmNoDeals")}</p>
            ) : (
              <ul className="space-y-1.5" data-testid="list-hubspot-deals">
                {ctx.deals.map((d) => (
                  <li key={d.externalId} className="text-[11px] bg-[#0f1729] rounded p-1.5 space-y-1">
                    <div className="text-white font-medium truncate">{d.title || "—"}</div>
                    <div className="text-[10px] text-[#b8c5d6] flex flex-wrap gap-x-2">
                      {d.amount != null && (
                        <span>
                          {t("inbox.crmDealAmount")}: {d.amount} {d.currency || ""}
                        </span>
                      )}
                      {d.closeDate && (
                        <span>
                          {t("inbox.crmDealClose")}: {new Date(d.closeDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {/* Étape éditable — déclenche updateDealStageMut */}
                    {allStages.length > 0 ? (
                      <select
                        value={d.stage || ""}
                        onChange={(e) => updateDealStageMut.mutate({ dealExternalId: d.externalId, dealstage: e.target.value })}
                        disabled={updateDealStageMut.isPending}
                        className="w-full text-[10px] bg-[#0a0f1c] border border-[#1f2937] rounded px-1 py-0.5 text-white"
                        data-testid={`select-hubspot-deal-stage-${d.externalId}`}
                      >
                        <option value="">—</option>
                        {allStages.map((s) => (
                          <option key={`${s.pipelineId}:${s.id}`} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      d.stage && (
                        <div className="text-[10px] text-[#b8c5d6]">
                          {t("inbox.crmDealStage")}: {d.stage}
                        </div>
                      )
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <Link href="/dashboard/parametres/crm">
        <button
          className="w-full text-[10px] text-primary hover:text-white transition-colors py-1 mt-1 border-t border-[#1f2937]"
          data-testid="button-hubspot-configure"
        >
          {t("inbox.crmConfigure")} →
        </button>
      </Link>
    </div>
  );
}

// ============================================================================
// Wave Pipedrive — Cockpit (parité HubSpot)
// Miroir 1:1 de HubspotContextPanel : mêmes mutations (log/create-deal/
// create-task/PATCH deal stage/PATCH person), mêmes data-testid mais
// préfixés `pipedrive-`. Différences notables :
//   - Pas de jobTitle/lifecycle/leadStatus dropdowns (Pipedrive n'a pas ces
//     champs natifs). Remplacé par un seul champ texte `label` éditable.
//   - L'option "+ Tâche" crée une activité Pipedrive type=task (Pipedrive
//     n'a pas d'objet "task" séparé).
//   - Pas de hint "reconnect_pipedrive" dédié dans i18n : le message neutre
//     `crmActionPipedriveErrorReconnect` est utilisé pour 401/403.
// ============================================================================
function PipedriveContextPanel({
  senderEmail,
  selectedEmailId,
  selectedSubject,
  selectedBody,
  selectedDate,
  collapsed,
  onToggleCollapsed,
  onHide,
}: {
  senderEmail: string | null;
  selectedEmailId: number | null;
  selectedSubject: string | null;
  selectedBody: string | null;
  selectedDate: string | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onHide: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const apiBase = `${import.meta.env.BASE_URL}api`;

  const { data: ctx, isLoading, isError } = useQuery({
    queryKey: ["pipedrive-contact-context", senderEmail],
    enabled: !!senderEmail && !collapsed,
    queryFn: async (): Promise<PipedriveContext | null> => {
      const res = await authedFetch(`${apiBase}/integrations/pipedrive/contact-context?email=${encodeURIComponent(senderEmail!)}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("failed");
      return res.json() as Promise<PipedriveContext>;
    },
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  // Chargement paresseux des pipelines (uniquement si on a un contact ET
  // qu'au moins un deal existe, ou si l'utilisateur ouvre "Créer affaire").
  const [pipelinesEnabled, setPipelinesEnabled] = useState(false);
  useEffect(() => {
    if (ctx && ctx.deals.length > 0) setPipelinesEnabled(true);
  }, [ctx]);
  const { data: pipelinesData } = useQuery({
    queryKey: ["pipedrive-pipelines"],
    enabled: pipelinesEnabled && !collapsed,
    queryFn: async (): Promise<PipedrivePipelinesResponse> => {
      const res = await authedFetch(`${apiBase}/integrations/pipedrive/pipelines`);
      if (!res.ok) throw new Error("failed");
      return res.json() as Promise<PipedrivePipelinesResponse>;
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const allStages = (pipelinesData?.pipelines || []).flatMap((p) =>
    p.stages.map((s) => ({ pipelineId: p.id, pipelineLabel: p.label, ...s })),
  );
  const defaultPipeline = pipelinesData?.pipelines?.[0];
  const defaultStage = defaultPipeline?.stages?.[0];

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["pipedrive-contact-context", senderEmail] });
  };

  // Helper centralisé : extrait le hint `reconnect_pipedrive` du payload
  // d'erreur backend. Toutes les mutations Pipedrive doivent passer par ici
  // pour garantir que les 401/403 (token expiré ou scope deals:full manquant)
  // affichent le toast "reconnecter Pipedrive" plutôt qu'un message brut.
  const throwPipedriveError = async (res: Response, fallback: string): Promise<never> => {
    const body = await res.json().catch(() => ({} as { error?: string; hint?: string }));
    const err = new Error(body.error || fallback) as Error & { hint?: string };
    err.hint = body.hint;
    throw err;
  };
  const showPipedriveError = (err: Error & { hint?: string }) => {
    const description = err.hint === "reconnect_pipedrive" ? t("inbox.crmActionPipedriveErrorReconnect") : err.message;
    toast({ title: t("inbox.crmActionPipedriveError"), description, variant: "destructive" });
  };

  const logEmailMut = useMutation({
    mutationFn: async () => {
      const res = await authedFetch(`${apiBase}/integrations/pipedrive/log-email`, {
        method: "POST",
        body: JSON.stringify({
          contactExternalId: ctx?.contact?.externalId,
          emailId: selectedEmailId,
          subject: selectedSubject,
          body: selectedBody,
          occurredAt: selectedDate,
        }),
      });
      if (!res.ok) await throwPipedriveError(res, "log failed");
      return res.json();
    },
    onSuccess: (data: { alreadyLogged?: boolean }) => {
      toast({
        title: data.alreadyLogged ? t("inbox.crmActionAlreadyLoggedPipedrive") : t("inbox.crmActionLogEmailDonePipedrive"),
      });
    },
    onError: showPipedriveError,
  });

  const createDealMut = useMutation({
    mutationFn: async (input: { dealname: string; amount: string; pipeline: string; dealstage: string; closedate: string }) => {
      const res = await authedFetch(`${apiBase}/integrations/pipedrive/create-deal`, {
        method: "POST",
        body: JSON.stringify({
          contactExternalId: ctx?.contact?.externalId,
          dealname: input.dealname,
          amount: input.amount ? Number(input.amount) : null,
          dealstage: input.dealstage || null,
          closedate: input.closedate || null,
        }),
      });
      if (!res.ok) await throwPipedriveError(res, "create deal failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("inbox.crmActionDealCreatedPipedrive") });
      setShowDealForm(false);
      refresh();
    },
    onError: showPipedriveError,
  });

  const createTaskMut = useMutation({
    mutationFn: async (input: { subject: string; body: string; dueAt: string }) => {
      const res = await authedFetch(`${apiBase}/integrations/pipedrive/create-task`, {
        method: "POST",
        body: JSON.stringify({
          contactExternalId: ctx?.contact?.externalId,
          subject: input.subject,
          body: input.body,
          dueAt: input.dueAt || null,
        }),
      });
      if (!res.ok) await throwPipedriveError(res, "create task failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("inbox.crmActionTaskCreatedPipedrive") });
      setShowTaskForm(false);
    },
    onError: showPipedriveError,
  });

  const updateDealStageMut = useMutation({
    mutationFn: async (input: { dealExternalId: string; dealstage: string }) => {
      const res = await authedFetch(`${apiBase}/integrations/pipedrive/deals/${encodeURIComponent(input.dealExternalId)}`, {
        method: "PATCH",
        body: JSON.stringify({ dealstage: input.dealstage }),
      });
      if (!res.ok) await throwPipedriveError(res, "update deal failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("inbox.crmActionDealStageUpdated") });
      refresh();
    },
    onError: showPipedriveError,
  });

  // Edition du `label` Pipedrive avec petit debounce manuel via state local
  // pour éviter un PATCH par caractère.
  const updateLabelMut = useMutation({
    mutationFn: async (label: string) => {
      if (!ctx?.contact?.externalId) throw new Error("no contact");
      const res = await authedFetch(`${apiBase}/integrations/pipedrive/contacts/${encodeURIComponent(ctx.contact.externalId)}`, {
        method: "PATCH",
        body: JSON.stringify({ label }),
      });
      if (!res.ok) await throwPipedriveError(res, "update contact failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("inbox.crmActionContactUpdatedPipedrive") });
      refresh();
    },
    onError: showPipedriveError,
  });

  const [showDealForm, setShowDealForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [dealName, setDealName] = useState("");
  const [dealAmount, setDealAmount] = useState("");
  const [dealPipeline, setDealPipeline] = useState("");
  const [dealStage, setDealStage] = useState("");
  const [dealClose, setDealClose] = useState("");
  const [taskSubject, setTaskSubject] = useState("");
  const [taskBody, setTaskBody] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [labelDraft, setLabelDraft] = useState<string>("");
  useEffect(() => {
    setLabelDraft(ctx?.contact?.label ?? "");
  }, [ctx?.contact?.label]);

  useEffect(() => {
    if (showDealForm) {
      setPipelinesEnabled(true);
      if (!dealName && selectedSubject) setDealName(selectedSubject.slice(0, 80));
      if (!dealClose) {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        setDealClose(d.toISOString().slice(0, 10));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDealForm]);
  useEffect(() => {
    if (showDealForm && defaultPipeline && !dealPipeline) setDealPipeline(defaultPipeline.id);
    if (showDealForm && defaultStage && !dealStage) setDealStage(defaultStage.id);
  }, [showDealForm, defaultPipeline, defaultStage, dealPipeline, dealStage]);
  useEffect(() => {
    if (showTaskForm) {
      if (!taskSubject) setTaskSubject(selectedSubject ? `Suivi : ${selectedSubject.slice(0, 80)}` : t("inbox.crmActionTaskDefaultTitle"));
      if (!taskDue) {
        const d = new Date();
        d.setDate(d.getDate() + 7);
        setTaskDue(d.toISOString().slice(0, 10));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTaskForm]);

  if (collapsed) {
    return (
      <div
        className="bg-card rounded-lg border border-primary/30 p-2 flex flex-col items-center gap-2"
        data-testid="panel-pipedrive-context-collapsed"
      >
        <Briefcase className="w-3.5 h-3.5 text-primary" />
        <button
          onClick={onToggleCollapsed}
          title={t("inbox.crmExpand")}
          className="text-[#b8c5d6] hover:text-white"
          data-testid="button-pipedrive-expand"
        >
          <Maximize2 className="w-3 h-3" />
        </button>
      </div>
    );
  }

  const fullName =
    [ctx?.contact?.firstName, ctx?.contact?.lastName].filter(Boolean).join(" ") ||
    ctx?.contact?.email ||
    senderEmail ||
    "—";
  const initials = ((ctx?.contact?.firstName?.[0] ?? "") + (ctx?.contact?.lastName?.[0] ?? "")).toUpperCase()
    || (senderEmail?.[0] ?? "?").toUpperCase();

  return (
    <div
      className="bg-card rounded-lg border border-primary/30 p-3 space-y-2"
      data-testid="panel-pipedrive-context"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-medium text-primary uppercase tracking-wider flex items-center gap-1.5">
          <Briefcase className="w-3 h-3" />
          {t("inbox.crmPipedrivePanelTitle")}
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleCollapsed}
            title={t("inbox.crmCollapse")}
            className="text-[#b8c5d6] hover:text-white"
            data-testid="button-pipedrive-collapse"
          >
            <Minimize2 className="w-3 h-3" />
          </button>
          <button
            onClick={onHide}
            title={t("inbox.crmHide")}
            className="text-[#b8c5d6] hover:text-white"
            data-testid="button-pipedrive-hide"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {!senderEmail && (
        <p className="text-[10px] text-[#b8c5d6] leading-relaxed">
          {t("inbox.crmSelectEmailHintPipedrive")}
        </p>
      )}

      {senderEmail && isLoading && (
        <p className="text-[10px] text-[#b8c5d6]">…</p>
      )}

      {senderEmail && !isLoading && (ctx === null || isError) && (
        <p className="text-[10px] text-[#b8c5d6] leading-relaxed" data-testid="text-pipedrive-no-match">
          {t("inbox.crmNoMatchPipedrive")}
        </p>
      )}

      {senderEmail && ctx && (
        <>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-medium shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-[12px] text-white font-medium truncate" data-testid="text-pipedrive-contact-name">{fullName}</p>
              {ctx.contact.email && (
                <p className="text-[10px] text-[#b8c5d6] truncate">{ctx.contact.email}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1 pt-1">
            <button
              type="button"
              onClick={() => logEmailMut.mutate()}
              disabled={!selectedEmailId || logEmailMut.isPending}
              title={t("inbox.crmActionLogEmailPipedrive")}
              className="text-[10px] bg-primary/10 hover:bg-primary/20 disabled:opacity-40 text-primary rounded px-1.5 py-1 flex items-center justify-center"
              data-testid="button-pipedrive-log-email"
            >
              {logEmailMut.isPending ? "…" : t("inbox.crmActionLogEmailShort")}
            </button>
            <button
              type="button"
              onClick={() => { setShowDealForm((v) => !v); setShowTaskForm(false); }}
              className={`text-[10px] rounded px-1.5 py-1 ${showDealForm ? "bg-primary text-white" : "bg-primary/10 hover:bg-primary/20 text-primary"}`}
              data-testid="button-pipedrive-toggle-deal-form"
            >
              {t("inbox.crmActionCreateDealShort")}
            </button>
            <button
              type="button"
              onClick={() => { setShowTaskForm((v) => !v); setShowDealForm(false); }}
              className={`text-[10px] rounded px-1.5 py-1 ${showTaskForm ? "bg-primary text-white" : "bg-primary/10 hover:bg-primary/20 text-primary"}`}
              data-testid="button-pipedrive-toggle-task-form"
            >
              {t("inbox.crmActionCreateTaskShort")}
            </button>
          </div>

          {showDealForm && (
            <div className="space-y-1.5 bg-[#0f1729] rounded p-2" data-testid="form-pipedrive-deal">
              <input
                type="text"
                value={dealName}
                onChange={(e) => setDealName(e.target.value)}
                placeholder={t("inbox.crmActionDealName")}
                className="w-full text-[10px] bg-[#0a0f1c] border border-[#1f2937] rounded px-1.5 py-1 text-white"
                data-testid="input-pipedrive-deal-name"
              />
              <input
                type="number"
                value={dealAmount}
                onChange={(e) => setDealAmount(e.target.value)}
                placeholder={t("inbox.crmActionDealAmount")}
                className="w-full text-[10px] bg-[#0a0f1c] border border-[#1f2937] rounded px-1.5 py-1 text-white"
                data-testid="input-pipedrive-deal-amount"
              />
              {allStages.length > 0 && (
                <select
                  value={dealStage}
                  onChange={(e) => {
                    setDealStage(e.target.value);
                    const found = allStages.find((s) => s.id === e.target.value);
                    if (found) setDealPipeline(found.pipelineId);
                  }}
                  className="w-full text-[10px] bg-[#0a0f1c] border border-[#1f2937] rounded px-1.5 py-1 text-white"
                  data-testid="select-pipedrive-deal-stage"
                >
                  {allStages.map((s) => (
                    <option key={`${s.pipelineId}:${s.id}`} value={s.id}>
                      {s.pipelineLabel} — {s.label}
                    </option>
                  ))}
                </select>
              )}
              <input
                type="date"
                value={dealClose}
                onChange={(e) => setDealClose(e.target.value)}
                className="w-full text-[10px] bg-[#0a0f1c] border border-[#1f2937] rounded px-1.5 py-1 text-white"
                data-testid="input-pipedrive-deal-close"
              />
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => createDealMut.mutate({ dealname: dealName, amount: dealAmount, pipeline: dealPipeline, dealstage: dealStage, closedate: dealClose })}
                  disabled={!dealName.trim() || createDealMut.isPending}
                  className="flex-1 text-[10px] bg-primary hover:bg-primary/90 disabled:opacity-40 text-white rounded px-1.5 py-1"
                  data-testid="button-pipedrive-deal-submit"
                >
                  {createDealMut.isPending ? "…" : t("inbox.crmActionSubmit")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDealForm(false)}
                  className="text-[10px] text-[#b8c5d6] hover:text-white px-1.5"
                >
                  {t("inbox.crmActionCancel")}
                </button>
              </div>
            </div>
          )}

          {showTaskForm && (
            <div className="space-y-1.5 bg-[#0f1729] rounded p-2" data-testid="form-pipedrive-task">
              <input
                type="text"
                value={taskSubject}
                onChange={(e) => setTaskSubject(e.target.value)}
                placeholder={t("inbox.crmActionTaskTitle")}
                className="w-full text-[10px] bg-[#0a0f1c] border border-[#1f2937] rounded px-1.5 py-1 text-white"
                data-testid="input-pipedrive-task-subject"
              />
              <textarea
                value={taskBody}
                onChange={(e) => setTaskBody(e.target.value)}
                placeholder={t("inbox.crmActionTaskNote")}
                rows={2}
                className="w-full text-[10px] bg-[#0a0f1c] border border-[#1f2937] rounded px-1.5 py-1 text-white resize-none"
                data-testid="textarea-pipedrive-task-body"
              />
              <input
                type="date"
                value={taskDue}
                onChange={(e) => setTaskDue(e.target.value)}
                className="w-full text-[10px] bg-[#0a0f1c] border border-[#1f2937] rounded px-1.5 py-1 text-white"
                data-testid="input-pipedrive-task-due"
              />
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => createTaskMut.mutate({ subject: taskSubject, body: taskBody, dueAt: taskDue })}
                  disabled={!taskSubject.trim() || createTaskMut.isPending}
                  className="flex-1 text-[10px] bg-primary hover:bg-primary/90 disabled:opacity-40 text-white rounded px-1.5 py-1"
                  data-testid="button-pipedrive-task-submit"
                >
                  {createTaskMut.isPending ? "…" : t("inbox.crmActionSubmit")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowTaskForm(false)}
                  className="text-[10px] text-[#b8c5d6] hover:text-white px-1.5"
                >
                  {t("inbox.crmActionCancel")}
                </button>
              </div>
            </div>
          )}

          {ctx.contact.company && (
            <div className="text-[11px]">
              <div className="text-[#b8c5d6] text-[10px]">{t("inbox.crmCompany")}</div>
              <div className="text-white">{ctx.contact.company}</div>
            </div>
          )}
          {ctx.contact.ownerName && (
            <div className="text-[11px]">
              <div className="text-[#b8c5d6] text-[10px]">{t("inbox.crmOwnerPipedrive")}</div>
              <div className="text-white">{ctx.contact.ownerName}</div>
            </div>
          )}

          {/* Label Pipedrive éditable (équivalent Person.label) — soumis sur blur */}
          <div className="text-[11px]">
            <div className="text-[#b8c5d6] text-[10px]">{t("inbox.crmLabelPipedrive")}</div>
            <input
              type="text"
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              onBlur={() => {
                const trimmed = labelDraft.trim();
                if (trimmed !== (ctx.contact.label ?? "").trim()) {
                  updateLabelMut.mutate(trimmed);
                }
              }}
              disabled={updateLabelMut.isPending}
              placeholder={t("inbox.crmLabelPipedrivePlaceholder")}
              className="w-full text-[10px] bg-[#0f1729] border border-[#1f2937] rounded px-1.5 py-1 text-white"
              data-testid="input-pipedrive-label"
            />
          </div>

          <div className="pt-2 border-t border-[#1f2937]">
            <div className="text-[#b8c5d6] text-[10px] uppercase tracking-wider mb-1.5">
              {t("inbox.crmDealsTitle")}
            </div>
            {ctx.deals.length === 0 ? (
              <p className="text-[10px] text-[#b8c5d6]">{t("inbox.crmNoDeals")}</p>
            ) : (
              <ul className="space-y-1.5" data-testid="list-pipedrive-deals">
                {ctx.deals.map((d) => (
                  <li key={d.externalId} className="text-[11px] bg-[#0f1729] rounded p-1.5 space-y-1">
                    <div className="text-white font-medium truncate">{d.title || "—"}</div>
                    <div className="text-[10px] text-[#b8c5d6] flex flex-wrap gap-x-2">
                      {d.amount != null && (
                        <span>
                          {t("inbox.crmDealAmount")}: {d.amount} {d.currency || ""}
                        </span>
                      )}
                      {d.closeDate && (
                        <span>
                          {t("inbox.crmDealClose")}: {new Date(d.closeDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {allStages.length > 0 ? (
                      <select
                        value={d.stage || ""}
                        onChange={(e) => updateDealStageMut.mutate({ dealExternalId: d.externalId, dealstage: e.target.value })}
                        disabled={updateDealStageMut.isPending}
                        className="w-full text-[10px] bg-[#0a0f1c] border border-[#1f2937] rounded px-1 py-0.5 text-white"
                        data-testid={`select-pipedrive-deal-stage-${d.externalId}`}
                      >
                        <option value="">—</option>
                        {allStages.map((s) => (
                          <option key={`${s.pipelineId}:${s.id}`} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      d.stage && (
                        <div className="text-[10px] text-[#b8c5d6]">
                          {t("inbox.crmDealStage")}: {d.stage}
                        </div>
                      )
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Activités récentes — 5 dernières activités du contact côté
              Pipedrive (mix tâches/notes/réunions). Repliée côté UI mais
              toujours présente : section vide affichée si pas d'activité.
              Mirroir de l'historique attendu en parité du panneau HubSpot. */}
          <div className="pt-2 border-t border-[#1f2937]">
            <div className="text-[#b8c5d6] text-[10px] uppercase tracking-wider mb-1.5">
              {t("inbox.crmPipedriveActivitiesTitle")}
            </div>
            {!ctx.activities || ctx.activities.length === 0 ? (
              <p className="text-[10px] text-[#b8c5d6]" data-testid="text-pipedrive-no-activities">
                {t("inbox.crmPipedriveNoActivities")}
              </p>
            ) : (
              <ul className="space-y-1" data-testid="list-pipedrive-activities">
                {ctx.activities.map((a) => (
                  <li
                    key={a.id}
                    className="text-[10px] bg-[#0f1729] rounded p-1.5"
                    data-testid={`item-pipedrive-activity-${a.id}`}
                  >
                    <div className="flex items-start gap-1">
                      <span className={a.done ? "text-emerald-400" : "text-amber-400"}>
                        {a.done ? "✓" : "•"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-white truncate">{a.subject || a.type || "—"}</div>
                        {(a.dueDate || a.addTime) && (
                          <div className="text-[#b8c5d6] text-[9px]">
                            {a.dueDate
                              ? new Date(a.dueDate).toLocaleDateString()
                              : a.addTime
                                ? new Date(a.addTime).toLocaleDateString()
                                : ""}
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <Link href="/dashboard/parametres/crm">
        <button
          className="w-full text-[10px] text-primary hover:text-white transition-colors py-1 mt-1 border-t border-[#1f2937]"
          data-testid="button-pipedrive-configure"
        >
          {t("inbox.crmConfigure")} →
        </button>
      </Link>
    </div>
  );
}

// ===========================================================================
// Salesforce — panneau cockpit (parité HubSpot/Pipedrive).
// Mêmes contrats côté UI : log email, créer Opportunity (deal Salesforce),
// créer Task, modifier StageName d'une Opp, éditer Description du Contact.
// Différences fonctionnelles : pas de currency (omis pour rester compatible
// avec orgs single-currency), `description` à la place du `label` Pipedrive,
// `tasks` à la place des `activities`.
// ===========================================================================
function SalesforceContextPanel({
  senderEmail,
  selectedEmailId,
  selectedSubject,
  selectedBody,
  selectedDate,
  collapsed,
  onToggleCollapsed,
  onHide,
}: {
  senderEmail: string | null;
  selectedEmailId: number | null;
  selectedSubject: string | null;
  selectedBody: string | null;
  selectedDate: string | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onHide: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const apiBase = `${import.meta.env.BASE_URL}api`;

  const { data: ctx, isLoading, isError } = useQuery({
    queryKey: ["salesforce-contact-context", senderEmail],
    enabled: !!senderEmail && !collapsed,
    queryFn: async (): Promise<SalesforceContext | null> => {
      const res = await authedFetch(
        `${apiBase}/integrations/salesforce/contact-context?email=${encodeURIComponent(senderEmail!)}`,
      );
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("failed");
      return res.json() as Promise<SalesforceContext>;
    },
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const [pipelinesEnabled, setPipelinesEnabled] = useState(false);
  useEffect(() => {
    if (ctx && ctx.deals.length > 0) setPipelinesEnabled(true);
  }, [ctx]);
  const { data: pipelinesData } = useQuery({
    queryKey: ["salesforce-pipelines"],
    enabled: pipelinesEnabled && !collapsed,
    queryFn: async (): Promise<SalesforcePipelinesResponse> => {
      const res = await authedFetch(`${apiBase}/integrations/salesforce/pipelines`);
      if (!res.ok) throw new Error("failed");
      return res.json() as Promise<SalesforcePipelinesResponse>;
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const allStages = (pipelinesData?.pipelines || []).flatMap((p) =>
    p.stages.map((s) => ({ pipelineId: p.id, pipelineLabel: p.label, ...s })),
  );
  const defaultPipeline = pipelinesData?.pipelines?.[0];
  const defaultStage = defaultPipeline?.stages?.[0];

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["salesforce-contact-context", senderEmail] });
  };

  // Helper centralisé : extrait `reconnect_salesforce` du payload backend.
  // Indispensable pour différencier 401/403 (token expiré, scope manquant)
  // d'une erreur métier classique → l'UI bascule sur un toast "reconnecter".
  const throwSalesforceError = async (res: Response, fallback: string): Promise<never> => {
    const body = await res.json().catch(() => ({} as { error?: string; hint?: string }));
    const err = new Error(body.error || fallback) as Error & { hint?: string };
    err.hint = body.hint;
    throw err;
  };
  const showSalesforceError = (err: Error & { hint?: string }) => {
    const description = err.hint === "reconnect_salesforce" ? t("inbox.crmActionSalesforceErrorReconnect") : err.message;
    toast({ title: t("inbox.crmActionSalesforceError"), description, variant: "destructive" });
  };

  const logEmailMut = useMutation({
    mutationFn: async () => {
      const res = await authedFetch(`${apiBase}/integrations/salesforce/log-email`, {
        method: "POST",
        body: JSON.stringify({
          contactExternalId: ctx?.contact?.externalId,
          emailId: selectedEmailId,
          subject: selectedSubject,
          body: selectedBody,
          occurredAt: selectedDate,
        }),
      });
      if (!res.ok) await throwSalesforceError(res, "log failed");
      return res.json();
    },
    onSuccess: (data: { alreadyLogged?: boolean }) => {
      toast({
        title: data.alreadyLogged
          ? t("inbox.crmActionAlreadyLoggedSalesforce")
          : t("inbox.crmActionLogEmailDoneSalesforce"),
      });
    },
    onError: showSalesforceError,
  });

  const createDealMut = useMutation({
    mutationFn: async (input: { dealname: string; amount: string; pipeline: string; dealstage: string; closedate: string }) => {
      const res = await authedFetch(`${apiBase}/integrations/salesforce/create-deal`, {
        method: "POST",
        body: JSON.stringify({
          contactExternalId: ctx?.contact?.externalId,
          dealname: input.dealname,
          amount: input.amount ? Number(input.amount) : null,
          dealstage: input.dealstage || null,
          closedate: input.closedate || null,
        }),
      });
      if (!res.ok) await throwSalesforceError(res, "create opportunity failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("inbox.crmActionDealCreatedSalesforce") });
      setShowDealForm(false);
      refresh();
    },
    onError: showSalesforceError,
  });

  const createTaskMut = useMutation({
    mutationFn: async (input: { subject: string; body: string; dueAt: string }) => {
      const res = await authedFetch(`${apiBase}/integrations/salesforce/create-task`, {
        method: "POST",
        body: JSON.stringify({
          contactExternalId: ctx?.contact?.externalId,
          subject: input.subject,
          body: input.body,
          dueAt: input.dueAt || null,
        }),
      });
      if (!res.ok) await throwSalesforceError(res, "create task failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("inbox.crmActionTaskCreatedSalesforce") });
      setShowTaskForm(false);
    },
    onError: showSalesforceError,
  });

  const updateDealStageMut = useMutation({
    mutationFn: async (input: { dealExternalId: string; dealstage: string }) => {
      const res = await authedFetch(
        `${apiBase}/integrations/salesforce/deals/${encodeURIComponent(input.dealExternalId)}`,
        { method: "PATCH", body: JSON.stringify({ dealstage: input.dealstage }) },
      );
      if (!res.ok) await throwSalesforceError(res, "update opportunity failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("inbox.crmActionDealStageUpdated") });
      refresh();
    },
    onError: showSalesforceError,
  });

  // Edition de la Description Salesforce avec submit on blur (équivalent du
  // label Pipedrive). Pas de PATCH par caractère — un PATCH si valeur changée.
  const updateDescriptionMut = useMutation({
    mutationFn: async (description: string) => {
      if (!ctx?.contact?.externalId) throw new Error("no contact");
      const res = await authedFetch(
        `${apiBase}/integrations/salesforce/contacts/${encodeURIComponent(ctx.contact.externalId)}`,
        { method: "PATCH", body: JSON.stringify({ description }) },
      );
      if (!res.ok) await throwSalesforceError(res, "update contact failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("inbox.crmActionContactUpdatedSalesforce") });
      refresh();
    },
    onError: showSalesforceError,
  });

  const [showDealForm, setShowDealForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [dealName, setDealName] = useState("");
  const [dealAmount, setDealAmount] = useState("");
  const [dealPipeline, setDealPipeline] = useState("");
  const [dealStage, setDealStage] = useState("");
  const [dealClose, setDealClose] = useState("");
  const [taskSubject, setTaskSubject] = useState("");
  const [taskBody, setTaskBody] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState<string>("");
  useEffect(() => {
    setDescriptionDraft(ctx?.contact?.description ?? "");
  }, [ctx?.contact?.description]);

  useEffect(() => {
    if (showDealForm) {
      setPipelinesEnabled(true);
      if (!dealName && selectedSubject) setDealName(selectedSubject.slice(0, 80));
      if (!dealClose) {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        setDealClose(d.toISOString().slice(0, 10));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDealForm]);
  useEffect(() => {
    if (showDealForm && defaultPipeline && !dealPipeline) setDealPipeline(defaultPipeline.id);
    if (showDealForm && defaultStage && !dealStage) setDealStage(defaultStage.id);
  }, [showDealForm, defaultPipeline, defaultStage, dealPipeline, dealStage]);
  useEffect(() => {
    if (showTaskForm) {
      if (!taskSubject) setTaskSubject(selectedSubject ? `Suivi : ${selectedSubject.slice(0, 80)}` : t("inbox.crmActionTaskDefaultTitle"));
      if (!taskDue) {
        const d = new Date();
        d.setDate(d.getDate() + 7);
        setTaskDue(d.toISOString().slice(0, 10));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTaskForm]);

  if (collapsed) {
    return (
      <div
        className="bg-card rounded-lg border border-sky-500/30 p-2 flex flex-col items-center gap-2"
        data-testid="panel-salesforce-context-collapsed"
      >
        <Cloud className="w-3.5 h-3.5 text-sky-400" />
        <button
          onClick={onToggleCollapsed}
          title={t("inbox.crmExpand")}
          className="text-[#b8c5d6] hover:text-white"
          data-testid="button-salesforce-expand"
        >
          <Maximize2 className="w-3 h-3" />
        </button>
      </div>
    );
  }

  const fullName =
    [ctx?.contact?.firstName, ctx?.contact?.lastName].filter(Boolean).join(" ") ||
    ctx?.contact?.email ||
    senderEmail ||
    "—";
  const initials = ((ctx?.contact?.firstName?.[0] ?? "") + (ctx?.contact?.lastName?.[0] ?? "")).toUpperCase()
    || (senderEmail?.[0] ?? "?").toUpperCase();

  return (
    <div
      className="bg-card rounded-lg border border-sky-500/30 p-3 space-y-2"
      data-testid="panel-salesforce-context"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-medium text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
          <Cloud className="w-3 h-3" />
          {t("inbox.crmSalesforcePanelTitle")}
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleCollapsed}
            title={t("inbox.crmCollapse")}
            className="text-[#b8c5d6] hover:text-white"
            data-testid="button-salesforce-collapse"
          >
            <Minimize2 className="w-3 h-3" />
          </button>
          <button
            onClick={onHide}
            title={t("inbox.crmHide")}
            className="text-[#b8c5d6] hover:text-white"
            data-testid="button-salesforce-hide"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {!senderEmail && (
        <p className="text-[10px] text-[#b8c5d6] leading-relaxed">
          {t("inbox.crmSelectEmailHintSalesforce")}
        </p>
      )}

      {senderEmail && isLoading && (
        <p className="text-[10px] text-[#b8c5d6]">…</p>
      )}

      {senderEmail && !isLoading && (ctx === null || isError) && (
        <p className="text-[10px] text-[#b8c5d6] leading-relaxed" data-testid="text-salesforce-no-match">
          {t("inbox.crmNoMatchSalesforce")}
        </p>
      )}

      {senderEmail && ctx && (
        <>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center text-[10px] font-medium shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-[12px] text-white font-medium truncate" data-testid="text-salesforce-contact-name">{fullName}</p>
              {ctx.contact.email && (
                <p className="text-[10px] text-[#b8c5d6] truncate">{ctx.contact.email}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1 pt-1">
            <button
              type="button"
              onClick={() => logEmailMut.mutate()}
              disabled={!selectedEmailId || logEmailMut.isPending}
              title={t("inbox.crmActionLogEmailSalesforce")}
              className="text-[10px] bg-sky-500/10 hover:bg-sky-500/20 disabled:opacity-40 text-sky-400 rounded px-1.5 py-1 flex items-center justify-center"
              data-testid="button-salesforce-log-email"
            >
              {logEmailMut.isPending ? "…" : t("inbox.crmActionLogEmailShort")}
            </button>
            <button
              type="button"
              onClick={() => { setShowDealForm((v) => !v); setShowTaskForm(false); }}
              className={`text-[10px] rounded px-1.5 py-1 ${showDealForm ? "bg-sky-500 text-white" : "bg-sky-500/10 hover:bg-sky-500/20 text-sky-400"}`}
              data-testid="button-salesforce-toggle-deal-form"
            >
              {t("inbox.crmActionCreateDealShort")}
            </button>
            <button
              type="button"
              onClick={() => { setShowTaskForm((v) => !v); setShowDealForm(false); }}
              className={`text-[10px] rounded px-1.5 py-1 ${showTaskForm ? "bg-sky-500 text-white" : "bg-sky-500/10 hover:bg-sky-500/20 text-sky-400"}`}
              data-testid="button-salesforce-toggle-task-form"
            >
              {t("inbox.crmActionCreateTaskShort")}
            </button>
          </div>

          {showDealForm && (
            <div className="space-y-1.5 bg-[#0f1729] rounded p-2" data-testid="form-salesforce-deal">
              <input
                type="text"
                value={dealName}
                onChange={(e) => setDealName(e.target.value)}
                placeholder={t("inbox.crmActionDealName")}
                className="w-full text-[10px] bg-[#0a0f1c] border border-[#1f2937] rounded px-1.5 py-1 text-white"
                data-testid="input-salesforce-deal-name"
              />
              <input
                type="number"
                value={dealAmount}
                onChange={(e) => setDealAmount(e.target.value)}
                placeholder={t("inbox.crmActionDealAmount")}
                className="w-full text-[10px] bg-[#0a0f1c] border border-[#1f2937] rounded px-1.5 py-1 text-white"
                data-testid="input-salesforce-deal-amount"
              />
              {allStages.length > 0 && (
                <select
                  value={dealStage}
                  onChange={(e) => {
                    setDealStage(e.target.value);
                    const found = allStages.find((s) => s.id === e.target.value);
                    if (found) setDealPipeline(found.pipelineId);
                  }}
                  className="w-full text-[10px] bg-[#0a0f1c] border border-[#1f2937] rounded px-1.5 py-1 text-white"
                  data-testid="select-salesforce-deal-stage"
                >
                  {allStages.map((s) => (
                    <option key={`${s.pipelineId}:${s.id}`} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              )}
              <input
                type="date"
                value={dealClose}
                onChange={(e) => setDealClose(e.target.value)}
                className="w-full text-[10px] bg-[#0a0f1c] border border-[#1f2937] rounded px-1.5 py-1 text-white"
                data-testid="input-salesforce-deal-close"
              />
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => createDealMut.mutate({ dealname: dealName, amount: dealAmount, pipeline: dealPipeline, dealstage: dealStage, closedate: dealClose })}
                  disabled={!dealName.trim() || createDealMut.isPending}
                  className="flex-1 text-[10px] bg-sky-500 hover:bg-sky-500/90 disabled:opacity-40 text-white rounded px-1.5 py-1"
                  data-testid="button-salesforce-deal-submit"
                >
                  {createDealMut.isPending ? "…" : t("inbox.crmActionSubmit")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDealForm(false)}
                  className="text-[10px] text-[#b8c5d6] hover:text-white px-1.5"
                >
                  {t("inbox.crmActionCancel")}
                </button>
              </div>
            </div>
          )}

          {showTaskForm && (
            <div className="space-y-1.5 bg-[#0f1729] rounded p-2" data-testid="form-salesforce-task">
              <input
                type="text"
                value={taskSubject}
                onChange={(e) => setTaskSubject(e.target.value)}
                placeholder={t("inbox.crmActionTaskTitle")}
                className="w-full text-[10px] bg-[#0a0f1c] border border-[#1f2937] rounded px-1.5 py-1 text-white"
                data-testid="input-salesforce-task-subject"
              />
              <textarea
                value={taskBody}
                onChange={(e) => setTaskBody(e.target.value)}
                placeholder={t("inbox.crmActionTaskNote")}
                rows={2}
                className="w-full text-[10px] bg-[#0a0f1c] border border-[#1f2937] rounded px-1.5 py-1 text-white resize-none"
                data-testid="textarea-salesforce-task-body"
              />
              <input
                type="date"
                value={taskDue}
                onChange={(e) => setTaskDue(e.target.value)}
                className="w-full text-[10px] bg-[#0a0f1c] border border-[#1f2937] rounded px-1.5 py-1 text-white"
                data-testid="input-salesforce-task-due"
              />
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => createTaskMut.mutate({ subject: taskSubject, body: taskBody, dueAt: taskDue })}
                  disabled={!taskSubject.trim() || createTaskMut.isPending}
                  className="flex-1 text-[10px] bg-sky-500 hover:bg-sky-500/90 disabled:opacity-40 text-white rounded px-1.5 py-1"
                  data-testid="button-salesforce-task-submit"
                >
                  {createTaskMut.isPending ? "…" : t("inbox.crmActionSubmit")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowTaskForm(false)}
                  className="text-[10px] text-[#b8c5d6] hover:text-white px-1.5"
                >
                  {t("inbox.crmActionCancel")}
                </button>
              </div>
            </div>
          )}

          {ctx.contact.company && (
            <div className="text-[11px]">
              <div className="text-[#b8c5d6] text-[10px]">{t("inbox.crmCompany")}</div>
              <div className="text-white">{ctx.contact.company}</div>
            </div>
          )}
          {ctx.contact.jobTitle && (
            <div className="text-[11px]">
              <div className="text-[#b8c5d6] text-[10px]">{t("inbox.crmJobTitleSalesforce")}</div>
              <div className="text-white">{ctx.contact.jobTitle}</div>
            </div>
          )}
          {ctx.contact.ownerName && (
            <div className="text-[11px]">
              <div className="text-[#b8c5d6] text-[10px]">{t("inbox.crmOwnerSalesforce")}</div>
              <div className="text-white">{ctx.contact.ownerName}</div>
            </div>
          )}

          {/* Description Salesforce éditable (équivalent du label Pipedrive) */}
          <div className="text-[11px]">
            <div className="text-[#b8c5d6] text-[10px]">{t("inbox.crmDescriptionSalesforce")}</div>
            <textarea
              value={descriptionDraft}
              onChange={(e) => setDescriptionDraft(e.target.value)}
              onBlur={() => {
                const trimmed = descriptionDraft.trim();
                if (trimmed !== (ctx.contact.description ?? "").trim()) {
                  updateDescriptionMut.mutate(trimmed);
                }
              }}
              disabled={updateDescriptionMut.isPending}
              rows={2}
              placeholder={t("inbox.crmDescriptionSalesforcePlaceholder")}
              className="w-full text-[10px] bg-[#0f1729] border border-[#1f2937] rounded px-1.5 py-1 text-white resize-none"
              data-testid="input-salesforce-description"
            />
          </div>

          <div className="pt-2 border-t border-[#1f2937]">
            <div className="text-[#b8c5d6] text-[10px] uppercase tracking-wider mb-1.5">
              {t("inbox.crmDealsTitle")}
            </div>
            {ctx.deals.length === 0 ? (
              <p className="text-[10px] text-[#b8c5d6]">{t("inbox.crmNoDeals")}</p>
            ) : (
              <ul className="space-y-1.5" data-testid="list-salesforce-deals">
                {ctx.deals.map((d) => (
                  <li key={d.externalId} className="text-[11px] bg-[#0f1729] rounded p-1.5 space-y-1">
                    <div className="text-white font-medium truncate">{d.title || "—"}</div>
                    <div className="text-[10px] text-[#b8c5d6] flex flex-wrap gap-x-2">
                      {d.amount != null && (
                        <span>
                          {t("inbox.crmDealAmount")}: {d.amount} {d.currency || ""}
                        </span>
                      )}
                      {d.closeDate && (
                        <span>
                          {t("inbox.crmDealClose")}: {new Date(d.closeDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {allStages.length > 0 ? (
                      <select
                        value={d.stage || ""}
                        onChange={(e) => updateDealStageMut.mutate({ dealExternalId: d.externalId, dealstage: e.target.value })}
                        disabled={updateDealStageMut.isPending}
                        className="w-full text-[10px] bg-[#0a0f1c] border border-[#1f2937] rounded px-1 py-0.5 text-white"
                        data-testid={`select-salesforce-deal-stage-${d.externalId}`}
                      >
                        <option value="">—</option>
                        {allStages.map((s) => (
                          <option key={`${s.pipelineId}:${s.id}`} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      d.stage && (
                        <div className="text-[10px] text-[#b8c5d6]">
                          {t("inbox.crmDealStage")}: {d.stage}
                        </div>
                      )
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Activités récentes — 5 dernières Tasks Salesforce du contact */}
          <div className="pt-2 border-t border-[#1f2937]">
            <div className="text-[#b8c5d6] text-[10px] uppercase tracking-wider mb-1.5">
              {t("inbox.crmSalesforceTasksTitle")}
            </div>
            {!ctx.tasks || ctx.tasks.length === 0 ? (
              <p className="text-[10px] text-[#b8c5d6]" data-testid="text-salesforce-no-tasks">
                {t("inbox.crmSalesforceNoTasks")}
              </p>
            ) : (
              <ul className="space-y-1" data-testid="list-salesforce-tasks">
                {ctx.tasks.map((tk) => (
                  <li
                    key={tk.id}
                    className="text-[10px] bg-[#0f1729] rounded p-1.5"
                    data-testid={`item-salesforce-task-${tk.id}`}
                  >
                    <div className="flex items-start gap-1">
                      <span className={tk.isClosed ? "text-emerald-400" : "text-amber-400"}>
                        {tk.isClosed ? "✓" : "•"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-white truncate">{tk.subject || "—"}</div>
                        {(tk.activityDate || tk.createdDate) && (
                          <div className="text-[#b8c5d6] text-[9px]">
                            {tk.activityDate
                              ? new Date(tk.activityDate).toLocaleDateString()
                              : tk.createdDate
                                ? new Date(tk.createdDate).toLocaleDateString()
                                : ""}
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <Link href="/dashboard/parametres/crm">
        <button
          className="w-full text-[10px] text-sky-400 hover:text-white transition-colors py-1 mt-1 border-t border-[#1f2937]"
          data-testid="button-salesforce-configure"
        >
          {t("inbox.crmConfigure")} →
        </button>
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// OdooContextPanel — 4ème CRM (parité visuelle/fonctionnelle minimale avec
// HubSpot/Pipedrive/Salesforce). Affiche le contact Odoo (res.partner) trouvé
// dans le cache pour l'expéditeur, ses opportunités (crm.lead) et activités
// (mail.activity). Bouton "Logger l'email" pousse une note sur la fiche.
// Couleur dédiée : indigo/purple (différencie des 3 autres CRMs).
// ---------------------------------------------------------------------------
type OdooContext = {
  contact: {
    externalId: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    company: string | null;
    phone: string | null;
    jobTitle: string | null;
    city: string | null;
    country: string | null;
    lastSyncedAt: string;
  };
  deals: Array<{
    externalId: string;
    title: string | null;
    amount: number | null;
    currency: string | null;
    stage: string | null;
    status: string | null;
    closeDate: string | null;
  }>;
  activities: Array<{
    id: string;
    summary: string | null;
    activityType: string | null;
    dueDate: string | null;
    state: string | null;
  }>;
};

function OdooContextPanel({
  senderEmail,
  selectedEmailId,
  selectedSubject,
  selectedBody,
  selectedDate,
  collapsed,
  onToggleCollapsed,
  onHide,
}: {
  senderEmail: string | null;
  selectedEmailId: number | null;
  selectedSubject: string | null;
  selectedBody: string | null;
  selectedDate: string | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onHide: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const apiBase = `${import.meta.env.BASE_URL}api`;

  const { data: ctx, isLoading, isError } = useQuery({
    queryKey: ["odoo-contact-context", senderEmail],
    enabled: !!senderEmail && !collapsed,
    queryFn: async (): Promise<OdooContext | null> => {
      const res = await authedFetch(
        `${apiBase}/integrations/odoo/contact-context?email=${encodeURIComponent(senderEmail!)}`,
      );
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("failed");
      return res.json() as Promise<OdooContext>;
    },
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["odoo-contact-context", senderEmail] });
  };

  const logEmailMut = useMutation({
    mutationFn: async () => {
      const res = await authedFetch(`${apiBase}/integrations/odoo/log-email`, {
        method: "POST",
        body: JSON.stringify({
          contactExternalId: ctx?.contact?.externalId,
          contactEmail: senderEmail,
          emailId: selectedEmailId,
          subject: selectedSubject,
          body: selectedBody,
          occurredAt: selectedDate,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as { error?: string }));
        throw new Error(body.error || "log failed");
      }
      return res.json() as Promise<{ ok: boolean; alreadyLogged?: boolean }>;
    },
    onSuccess: (data) => {
      toast({
        title: data.alreadyLogged
          ? t("inbox.crmActionAlreadyLoggedOdoo")
          : t("inbox.crmActionLogEmailDoneOdoo"),
      });
      refresh();
    },
    onError: (err: Error) => {
      toast({ title: t("inbox.crmActionOdooError"), description: err.message, variant: "destructive" });
    },
  });

  // Cockpit Odoo — formulaires "Créer opportunité" et "Créer activité"
  // (parité minimale avec HubSpot/Pipedrive/Salesforce). Les types
  // d'activité sont chargés à la demande quand le formulaire s'ouvre,
  // pour éviter un appel JSON-RPC inutile.
  const [showOdooDealForm, setShowOdooDealForm] = useState(false);
  const [showOdooActivityForm, setShowOdooActivityForm] = useState(false);
  const [odooDealName, setOdooDealName] = useState("");
  const [odooDealAmount, setOdooDealAmount] = useState("");
  const [odooDealDeadline, setOdooDealDeadline] = useState("");
  const [odooActivityTypeId, setOdooActivityTypeId] = useState<string>("");
  const [odooActivitySummary, setOdooActivitySummary] = useState("");
  const [odooActivityNote, setOdooActivityNote] = useState("");
  const [odooActivityDue, setOdooActivityDue] = useState("");
  const [odooActivityTypesEnabled, setOdooActivityTypesEnabled] = useState(false);

  const { data: odooActivityTypesData } = useQuery({
    queryKey: ["odoo-activity-types"],
    enabled: odooActivityTypesEnabled && !collapsed,
    queryFn: async (): Promise<{ activityTypes: Array<{ id: number; name: string }> }> => {
      const res = await authedFetch(`${apiBase}/integrations/odoo/activity-types`);
      if (!res.ok) throw new Error("failed");
      return res.json() as Promise<{ activityTypes: Array<{ id: number; name: string }> }>;
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const odooActivityTypes = odooActivityTypesData?.activityTypes ?? [];

  // Préremplissage du form deal quand on l'ouvre (basé sur l'email courant)
  useEffect(() => {
    if (showOdooDealForm) {
      if (!odooDealName && selectedSubject) setOdooDealName(selectedSubject.slice(0, 80));
      if (!odooDealDeadline) {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        setOdooDealDeadline(d.toISOString().slice(0, 10));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showOdooDealForm]);

  // Préremplissage du form activité + déclenche le chargement des types Odoo
  useEffect(() => {
    if (showOdooActivityForm) {
      setOdooActivityTypesEnabled(true);
      if (!odooActivitySummary) {
        setOdooActivitySummary(
          selectedSubject ? `Suivi : ${selectedSubject.slice(0, 80)}` : t("inbox.crmActionTaskDefaultTitle"),
        );
      }
      if (!odooActivityDue) {
        const d = new Date();
        d.setDate(d.getDate() + 7);
        setOdooActivityDue(d.toISOString().slice(0, 10));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showOdooActivityForm]);

  // Cale le type d'activité par défaut sur le premier disponible
  useEffect(() => {
    if (showOdooActivityForm && odooActivityTypes.length > 0 && !odooActivityTypeId) {
      setOdooActivityTypeId(String(odooActivityTypes[0]!.id));
    }
  }, [showOdooActivityForm, odooActivityTypes, odooActivityTypeId]);

  const createOdooDealMut = useMutation({
    mutationFn: async () => {
      const res = await authedFetch(`${apiBase}/integrations/odoo/create-deal`, {
        method: "POST",
        body: JSON.stringify({
          contactExternalId: ctx?.contact?.externalId,
          name: odooDealName,
          expectedRevenue: odooDealAmount ? Number(odooDealAmount) : null,
          dateDeadline: odooDealDeadline || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as { error?: string }));
        throw new Error(body.error || "create deal failed");
      }
      return res.json() as Promise<{ ok: boolean; id?: string }>;
    },
    onSuccess: () => {
      toast({ title: t("inbox.crmActionDealCreatedOdoo") });
      setShowOdooDealForm(false);
      setOdooDealName("");
      setOdooDealAmount("");
      setOdooDealDeadline("");
      refresh();
    },
    onError: (err: Error) => {
      toast({ title: t("inbox.crmActionOdooError"), description: err.message, variant: "destructive" });
    },
  });

  const createOdooActivityMut = useMutation({
    mutationFn: async () => {
      const res = await authedFetch(`${apiBase}/integrations/odoo/create-activity`, {
        method: "POST",
        body: JSON.stringify({
          contactExternalId: ctx?.contact?.externalId,
          summary: odooActivitySummary,
          note: odooActivityNote,
          dateDeadline: odooActivityDue || null,
          activityTypeId: odooActivityTypeId ? Number(odooActivityTypeId) : null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as { error?: string }));
        throw new Error(body.error || "create activity failed");
      }
      return res.json() as Promise<{ ok: boolean; id?: string }>;
    },
    onSuccess: () => {
      toast({ title: t("inbox.crmActionActivityCreatedOdoo") });
      setShowOdooActivityForm(false);
      setOdooActivitySummary("");
      setOdooActivityNote("");
      setOdooActivityDue("");
      refresh();
    },
    onError: (err: Error) => {
      toast({ title: t("inbox.crmActionOdooError"), description: err.message, variant: "destructive" });
    },
  });

  if (collapsed) {
    return (
      <div
        className="bg-card rounded-lg border border-indigo-500/30 p-2 flex items-center justify-between"
        data-testid="panel-odoo-context-collapsed"
      >
        <span className="text-[10px] font-medium text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
          <Database className="w-3 h-3" />
          {t("inbox.crmOdooPanelTitle")}
        </span>
        <button
          onClick={onToggleCollapsed}
          title={t("inbox.crmExpand")}
          className="text-[#b8c5d6] hover:text-white"
          data-testid="button-odoo-expand"
        >
          <Maximize2 className="w-3 h-3" />
        </button>
      </div>
    );
  }

  const fullName =
    [ctx?.contact?.firstName, ctx?.contact?.lastName].filter(Boolean).join(" ") ||
    ctx?.contact?.email ||
    senderEmail ||
    "—";
  const initials = ((ctx?.contact?.firstName?.[0] ?? "") + (ctx?.contact?.lastName?.[0] ?? "")).toUpperCase()
    || (senderEmail?.[0] ?? "?").toUpperCase();

  return (
    <div
      className="bg-card rounded-lg border border-indigo-500/30 p-3 space-y-2"
      data-testid="panel-odoo-context"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-medium text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
          <Database className="w-3 h-3" />
          {t("inbox.crmOdooPanelTitle")}
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleCollapsed}
            title={t("inbox.crmCollapse")}
            className="text-[#b8c5d6] hover:text-white"
            data-testid="button-odoo-collapse"
          >
            <Minimize2 className="w-3 h-3" />
          </button>
          <button
            onClick={onHide}
            title={t("inbox.crmHide")}
            className="text-[#b8c5d6] hover:text-white"
            data-testid="button-odoo-hide"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {!senderEmail && (
        <p className="text-[10px] text-[#b8c5d6] leading-relaxed">
          {t("inbox.crmSelectEmailHintOdoo")}
        </p>
      )}

      {senderEmail && isLoading && (
        <p className="text-[10px] text-[#b8c5d6]">…</p>
      )}

      {senderEmail && !isLoading && (ctx === null || isError) && (
        <p className="text-[10px] text-[#b8c5d6] leading-relaxed" data-testid="text-odoo-no-match">
          {t("inbox.crmNoMatchOdoo")}
        </p>
      )}

      {senderEmail && ctx && (
        <>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-medium shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-[12px] text-white font-medium truncate" data-testid="text-odoo-contact-name">{fullName}</p>
              {ctx.contact.email && (
                <p className="text-[10px] text-[#b8c5d6] truncate">{ctx.contact.email}</p>
              )}
            </div>
          </div>

          {(ctx.contact.company || ctx.contact.jobTitle || ctx.contact.phone || ctx.contact.city) && (
            <div className="text-[10px] text-[#b8c5d6] space-y-0.5">
              {ctx.contact.company && (
                <div className="truncate"><span className="text-[#5b6b85]">{t("inbox.crmCompany")} :</span> <span className="text-white">{ctx.contact.company}</span></div>
              )}
              {ctx.contact.jobTitle && (
                <div className="truncate"><span className="text-[#5b6b85]">{t("inbox.crmJobTitle")} :</span> <span className="text-white">{ctx.contact.jobTitle}</span></div>
              )}
              {ctx.contact.phone && (
                <div className="truncate"><span className="text-[#5b6b85]">{t("inbox.crmOdooPhone")} :</span> <span className="text-white">{ctx.contact.phone}</span></div>
              )}
              {(ctx.contact.city || ctx.contact.country) && (
                <div className="truncate"><span className="text-[#5b6b85]">{t("inbox.crmOdooLocation")} :</span> <span className="text-white">{[ctx.contact.city, ctx.contact.country].filter(Boolean).join(", ")}</span></div>
              )}
            </div>
          )}

          {/* Cockpit Odoo — 3 actions (parité HubSpot/Pipedrive/Salesforce) */}
          <div className="grid grid-cols-3 gap-1 pt-1">
            <button
              type="button"
              onClick={() => logEmailMut.mutate()}
              disabled={!selectedEmailId || logEmailMut.isPending}
              title={t("inbox.crmActionLogEmailOdoo")}
              className="text-[10px] bg-indigo-500/10 hover:bg-indigo-500/20 disabled:opacity-40 text-indigo-400 rounded px-1.5 py-1 flex items-center justify-center"
              data-testid="button-odoo-log-email"
            >
              {logEmailMut.isPending ? "…" : t("inbox.crmActionLogEmailShort")}
            </button>
            <button
              type="button"
              onClick={() => { setShowOdooDealForm((v) => !v); setShowOdooActivityForm(false); }}
              title={t("inbox.crmActionCreateDealOdoo")}
              className={`text-[10px] rounded px-1.5 py-1 ${showOdooDealForm ? "bg-indigo-500 text-white" : "bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400"}`}
              data-testid="button-odoo-toggle-deal-form"
            >
              {t("inbox.crmActionCreateDealShort")}
            </button>
            <button
              type="button"
              onClick={() => { setShowOdooActivityForm((v) => !v); setShowOdooDealForm(false); }}
              title={t("inbox.crmActionCreateActivityOdoo")}
              className={`text-[10px] rounded px-1.5 py-1 ${showOdooActivityForm ? "bg-indigo-500 text-white" : "bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400"}`}
              data-testid="button-odoo-toggle-activity-form"
            >
              {t("inbox.crmActionCreateActivityShort")}
            </button>
          </div>

          {/* Formulaire création opportunité (crm.lead) */}
          {showOdooDealForm && (
            <div className="space-y-1.5 bg-[#0f1729] rounded p-2" data-testid="form-odoo-deal">
              <input
                type="text"
                value={odooDealName}
                onChange={(e) => setOdooDealName(e.target.value)}
                placeholder={t("inbox.crmActionDealName")}
                className="w-full text-[10px] bg-[#0a0f1c] border border-[#1f2937] rounded px-1.5 py-1 text-white"
                data-testid="input-odoo-deal-name"
              />
              <input
                type="number"
                value={odooDealAmount}
                onChange={(e) => setOdooDealAmount(e.target.value)}
                placeholder={t("inbox.crmActionDealAmount")}
                className="w-full text-[10px] bg-[#0a0f1c] border border-[#1f2937] rounded px-1.5 py-1 text-white"
                data-testid="input-odoo-deal-amount"
              />
              <input
                type="date"
                value={odooDealDeadline}
                onChange={(e) => setOdooDealDeadline(e.target.value)}
                className="w-full text-[10px] bg-[#0a0f1c] border border-[#1f2937] rounded px-1.5 py-1 text-white"
                data-testid="input-odoo-deal-deadline"
              />
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => createOdooDealMut.mutate()}
                  disabled={!odooDealName.trim() || createOdooDealMut.isPending}
                  className="flex-1 text-[10px] bg-indigo-500 hover:bg-indigo-500/90 disabled:opacity-40 text-white rounded px-1.5 py-1"
                  data-testid="button-odoo-deal-submit"
                >
                  {createOdooDealMut.isPending ? "…" : t("inbox.crmActionSubmit")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowOdooDealForm(false)}
                  className="text-[10px] text-[#b8c5d6] hover:text-white px-1.5"
                >
                  {t("inbox.crmActionCancel")}
                </button>
              </div>
            </div>
          )}

          {/* Formulaire création activité (mail.activity) */}
          {showOdooActivityForm && (
            <div className="space-y-1.5 bg-[#0f1729] rounded p-2" data-testid="form-odoo-activity">
              {odooActivityTypes.length > 0 && (
                <select
                  value={odooActivityTypeId}
                  onChange={(e) => setOdooActivityTypeId(e.target.value)}
                  className="w-full text-[10px] bg-[#0a0f1c] border border-[#1f2937] rounded px-1.5 py-1 text-white"
                  data-testid="select-odoo-activity-type"
                >
                  {odooActivityTypes.map((tp) => (
                    <option key={tp.id} value={String(tp.id)}>{tp.name}</option>
                  ))}
                </select>
              )}
              <input
                type="text"
                value={odooActivitySummary}
                onChange={(e) => setOdooActivitySummary(e.target.value)}
                placeholder={t("inbox.crmActionTaskTitle")}
                className="w-full text-[10px] bg-[#0a0f1c] border border-[#1f2937] rounded px-1.5 py-1 text-white"
                data-testid="input-odoo-activity-summary"
              />
              <textarea
                value={odooActivityNote}
                onChange={(e) => setOdooActivityNote(e.target.value)}
                placeholder={t("inbox.crmActionTaskNote")}
                rows={2}
                className="w-full text-[10px] bg-[#0a0f1c] border border-[#1f2937] rounded px-1.5 py-1 text-white resize-none"
                data-testid="textarea-odoo-activity-note"
              />
              <input
                type="date"
                value={odooActivityDue}
                onChange={(e) => setOdooActivityDue(e.target.value)}
                className="w-full text-[10px] bg-[#0a0f1c] border border-[#1f2937] rounded px-1.5 py-1 text-white"
                data-testid="input-odoo-activity-due"
              />
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => createOdooActivityMut.mutate()}
                  disabled={!odooActivitySummary.trim() || createOdooActivityMut.isPending}
                  className="flex-1 text-[10px] bg-indigo-500 hover:bg-indigo-500/90 disabled:opacity-40 text-white rounded px-1.5 py-1"
                  data-testid="button-odoo-activity-submit"
                >
                  {createOdooActivityMut.isPending ? "…" : t("inbox.crmActionSubmit")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowOdooActivityForm(false)}
                  className="text-[10px] text-[#b8c5d6] hover:text-white px-1.5"
                >
                  {t("inbox.crmActionCancel")}
                </button>
              </div>
            </div>
          )}

          <div className="border-t border-[#1f2937] pt-1.5">
            <h4 className="text-[9px] uppercase tracking-wider text-[#5b6b85] mb-1">
              {t("inbox.crmOdooDealsTitle")}
            </h4>
            {ctx.deals.length === 0 ? (
              <p className="text-[10px] text-[#5b6b85] italic">{t("inbox.crmOdooDealsNone")}</p>
            ) : (
              <ul className="space-y-1">
                {ctx.deals.slice(0, 5).map((d) => (
                  <li key={d.externalId} className="text-[10px] flex items-start gap-1.5" data-testid={`row-odoo-deal-${d.externalId}`}>
                    <span className={d.status === "won" ? "text-emerald-400" : d.status === "lost" ? "text-rose-400" : "text-amber-400"}>•</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-white truncate">{d.title || "—"}</div>
                      <div className="text-[#b8c5d6] text-[9px] flex items-center gap-2">
                        {d.stage && <span>{d.stage}</span>}
                        {d.amount != null && (
                          <span>{d.amount.toLocaleString()} {d.currency || ""}</span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-[#1f2937] pt-1.5">
            <h4 className="text-[9px] uppercase tracking-wider text-[#5b6b85] mb-1">
              {t("inbox.crmOdooActivitiesTitle")}
            </h4>
            {ctx.activities.length === 0 ? (
              <p className="text-[10px] text-[#5b6b85] italic">{t("inbox.crmOdooActivitiesNone")}</p>
            ) : (
              <ul className="space-y-1">
                {ctx.activities.slice(0, 5).map((a) => (
                  <li key={a.id} className="text-[10px] flex items-start gap-1.5">
                    <span className={a.state === "done" ? "text-emerald-400" : a.state === "overdue" ? "text-rose-400" : "text-amber-400"}>
                      {a.state === "done" ? "✓" : "•"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-white truncate">{a.summary || a.activityType || "—"}</div>
                      {a.dueDate && (
                        <div className="text-[#b8c5d6] text-[9px]">
                          {new Date(a.dueDate).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <Link href="/dashboard/parametres/crm">
        <button
          className="w-full text-[10px] text-indigo-400 hover:text-white transition-colors py-1 mt-1 border-t border-[#1f2937]"
          data-testid="button-odoo-configure"
        >
          {t("inbox.crmConfigure")} →
        </button>
      </Link>
    </div>
  );
}

export default function Dashboard() {
  // #247 — active la palette light/dark uniquement sur la Réception.
  useMarkInboxPage();
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? i18n.language.split("-")[0];
  const dateFnsLocale = ({fr,en:enUS,nl,de,es,it,pt,pl}[(i18n.resolvedLanguage || i18n.language || "fr").substring(0,2)] || fr);
  const [filterPriority, setFilterPriority] = useState<string>("all");
  // Wave HubSpot/Pipedrive — filtre Réception sur les expéditeurs présents
  // dans le CRM choisi. crmFilter = null désactive le filtre.
  const [crmFilter, setCrmFilter] = useState<"hubspot" | "pipedrive" | "salesforce" | "odoo" | null>(null);
  const [crmPanelCollapsed, setCrmPanelCollapsed] = useState(false);
  const [detailHubspotPanelHidden, setDetailHubspotPanelHidden] = useState(false);
  const [detailPipedrivePanelHidden, setDetailPipedrivePanelHidden] = useState(false);
  const [detailSalesforcePanelHidden, setDetailSalesforcePanelHidden] = useState(false);
  const [detailOdooPanelHidden, setDetailOdooPanelHidden] = useState(false);
  // Sélecteur exclusif du panneau CRM affiché dans la colonne droite quand
  // PLUSIEURS intégrations sont actives. Par défaut HubSpot (parité avec le
  // comportement antérieur). L'utilisateur bascule via les onglets affichés
  // au-dessus du panneau. Si une seule intégration est connectée, ce state
  // est forcé sur celle-là (cf. useEffect plus bas). Étendu à 3 valeurs
  // pour intégrer Salesforce en parité totale.
  const [activeCrmDetailPanel, setActiveCrmDetailPanel] = useState<"hubspot" | "pipedrive" | "salesforce" | "odoo">("hubspot");
  const integrationsQuery = useListIntegrations();
  const integrationsList = (integrationsQuery.data ?? []) as Integration[];
  const hasHubspot = integrationsList.some(
    (i) => String(i.provider) === "hubspot" && i.enabled,
  );
  const hasPipedrive = integrationsList.some(
    (i) => String(i.provider) === "pipedrive" && i.enabled,
  );
  const hasSalesforce = integrationsList.some(
    (i) => String(i.provider) === "salesforce" && i.enabled,
  );
  // Wave Odoo — 4ème CRM (URL + DB + login + clé API). Détection identique
  // aux 3 autres : présence d'une intégration `odoo` activée pour ce user.
  const hasOdoo = integrationsList.some(
    (i) => String(i.provider) === "odoo" && i.enabled,
  );
  // Désactive automatiquement le filtre si le CRM ciblé est déconnecté.
  useEffect(() => {
    if (!hasHubspot && crmFilter === "hubspot") setCrmFilter(null);
    if (!hasPipedrive && crmFilter === "pipedrive") setCrmFilter(null);
    if (!hasSalesforce && crmFilter === "salesforce") setCrmFilter(null);
    if (!hasOdoo && crmFilter === "odoo") setCrmFilter(null);
  }, [hasHubspot, hasPipedrive, hasSalesforce, hasOdoo, crmFilter]);
  // Recale le panneau actif sur le seul CRM disponible. Logique étendue à 3
  // CRMs : si exactement un seul est connecté, on force sa sélection. Sinon
  // (0 ou ≥2 connectés), on conserve la sélection courante (l'utilisateur
  // basculera via les onglets si besoin). Si l'onglet courant pointe vers
  // un CRM déconnecté, on retombe sur le premier disponible.
  useEffect(() => {
    const connected: Array<"hubspot" | "pipedrive" | "salesforce" | "odoo"> = [];
    if (hasHubspot) connected.push("hubspot");
    if (hasPipedrive) connected.push("pipedrive");
    if (hasSalesforce) connected.push("salesforce");
    if (hasOdoo) connected.push("odoo");
    if (connected.length === 1 && activeCrmDetailPanel !== connected[0]) {
      setActiveCrmDetailPanel(connected[0]!);
    } else if (connected.length > 1 && !connected.includes(activeCrmDetailPanel)) {
      setActiveCrmDetailPanel(connected[0]!);
    }
  }, [hasHubspot, hasPipedrive, hasSalesforce, hasOdoo, activeCrmDetailPanel]);
  const [sortMode, setSortMode] = useState<"priority" | "date_desc" | "date_asc">(() => {
    if (typeof window === "undefined") return "priority";
    const saved = window.localStorage.getItem("inbox.sortMode");
    return saved === "date_desc" || saved === "date_asc" || saved === "priority" ? saved : "priority";
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("inbox.sortMode", sortMode);
    }
  }, [sortMode]);
  // Inboria Phase 3 — Smart sort. When enabled, the server orders the page
  // by Inboria strategic score (deadline, awaiting reply, escalation…)
  // and we skip the client-side sort to preserve that order.
  const [smartSort, setSmartSort] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const saved = window.localStorage.getItem("inbox.smartSort");
    return saved === null ? true : saved === "1";
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("inbox.smartSort", smartSort ? "1" : "0");
    }
  }, [smartSort]);
  const [selectedEmailId, setSelectedEmailId] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const id = params.get("emailId");
    const num = id ? Number(id) : NaN;
    return Number.isFinite(num) && num > 0 ? num : null;
  });
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const a = params.get("assignee");
    return a && a.trim() ? a.trim() : null;
  });
  const [routeLocation] = useLocation();
  // Subscribe to URL changes — wouter v3 only tracks pathname, but query
  // strings change too (e.g. clicking "Assignés" → /dashboard?assignee=me).
  // wouter dispatches custom "pushState"/"replaceState" events on window for
  // same-page nav, and the browser fires "popstate" on back/forward.
  const [searchString, setSearchString] = useState<string>(
    () => (typeof window !== "undefined" ? window.location.search : ""),
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setSearchString(window.location.search);
    window.addEventListener("popstate", update);
    window.addEventListener("pushState" as any, update);
    window.addEventListener("replaceState" as any, update);
    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener("pushState" as any, update);
      window.removeEventListener("replaceState" as any, update);
    };
  }, []);
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const a = params.get("assignee");
    setAssigneeFilter(a && a.trim() ? a.trim() : null);
  }, [searchString, routeLocation]);
  // Inboria chat → "Ouvrir" : navigue vers /dashboard?emailId=X. Comme
  // l'init de selectedEmailId via useState ne tourne qu'au premier mount,
  // on doit aussi écouter les changements d'URL pour ouvrir l'email.
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const id = params.get("emailId");
    const num = id ? Number(id) : NaN;
    if (Number.isFinite(num) && num > 0) {
      setSelectedEmailId(num);
    }
  }, [searchString, routeLocation]);
  // Canal direct : Inboria chat émet "inboria-open-mail" pour ouvrir un
  // mail sans dépendre de la propagation des query strings par wouter.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { id?: number } | undefined;
      const id = Number(detail?.id);
      if (Number.isFinite(id) && id > 0) {
        setSelectedEmailId(id);
      }
    };
    window.addEventListener("inboria-open-mail", handler);
    return () => window.removeEventListener("inboria-open-mail", handler);
  }, []);
  const clearAssigneeFilter = () => {
    setAssigneeFilter(null);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("assignee");
      window.history.replaceState({}, "", url.toString());
    }
  };
  // Réafficher les panneaux CRM à chaque changement d'email ouvert :
  // si l'utilisateur les a masqués sur un email, on ne veut pas que ce
  // masquage persiste sur l'email suivant (chaque email mérite son contexte).
  useEffect(() => {
    setDetailHubspotPanelHidden(false);
    setDetailPipedrivePanelHidden(false);
    setDetailSalesforcePanelHidden(false);
    setDetailOdooPanelHidden(false);
  }, [selectedEmailId]);
  // Quand l'utilisateur reclique sur "Réception" dans la sidebar alors qu'il
  // est déjà sur /dashboard, on ferme l'email ouvert pour revenir à la liste.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.href === "/dashboard") {
        setSelectedEmailId(null);
      }
    };
    window.addEventListener("sidebar-nav-reset", handler);
    return () => window.removeEventListener("sidebar-nav-reset", handler);
  }, []);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const searchQuery = useDebounce(searchInput, 300);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [inboxMode, setInboxMode] = useState<InboxMode>("personal");
  const [selectedSharedMailboxId, setSelectedSharedMailboxId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all");

  const { data: composeConnections } = useQuery<Array<{ id: string; provider: string; email_address: string; signature?: string | null; consecutive_failures?: number | null; last_error_message?: string | null }>>({
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

  const selectedAccountEmailForCounts = (() => {
    if (inboxMode !== "personal" || selectedAccountId === "all") return undefined;
    const c = composeConnections?.find((x) => String(x.id) === String(selectedAccountId));
    return c?.email_address || undefined;
  })();
  const categoryCountsParams = inboxMode === "shared" && selectedSharedMailboxId
    ? { scope: "shared" as const, sharedMailboxId: selectedSharedMailboxId }
    : { scope: "personal" as const, accountEmail: selectedAccountEmailForCounts };
  const { data: categoryCounts, isLoading: categoriesLoading } = useGetCategoryCounts(categoryCountsParams);

  // Bootstrap aggregator: one roundtrip to seed the React Query cache for the
  // slow-moving "socle" data (profile, organisation, members, mailboxes,
  // projects, integrations, summary). Subsequent useGet* hooks below read
  // from cache instantly and refresh in background.
  const { data: bootstrap } = useGetDashboardBootstrap();
  useEffect(() => {
    if (!bootstrap) return;
    const b = bootstrap as any;
    if (b.profile) queryClient.setQueryData(getGetProfileQueryKey(), b.profile);
    if (b.organisation !== undefined) queryClient.setQueryData(getGetMyOrganisationQueryKey(), b.organisation);
    if (Array.isArray(b.members)) queryClient.setQueryData(getGetOrganisationMembersQueryKey(), b.members);
    if (Array.isArray(b.sharedMailboxes)) queryClient.setQueryData(getGetSharedMailboxesQueryKey(), b.sharedMailboxes);
    if (Array.isArray(b.projects)) queryClient.setQueryData(getListProjectsQueryKey(), b.projects);
    if (Array.isArray(b.integrations)) queryClient.setQueryData(getListIntegrationsQueryKey(), b.integrations);
    if (b.summary) queryClient.setQueryData(getGetDashboardSummaryQueryKey(), b.summary);
  }, [bootstrap, queryClient]);

  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary();
  const { data: projects } = useListProjects();
  const { data: profile } = useGetProfile();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const uid = (profile as { id?: string } | undefined)?.id;
    if (!uid) {
      setSelectedAccountId("all");
      return;
    }
    const stored = window.localStorage.getItem(`inboria.selectedAccount:${uid}`);
    setSelectedAccountId(stored || "all");
  }, [profile]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const uid = (profile as { id?: string } | undefined)?.id;
    if (!uid) return;
    window.localStorage.setItem(`inboria.selectedAccount:${uid}`, selectedAccountId);
  }, [selectedAccountId, profile]);

  const disconnectedToastFiredRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (disconnectedToastFiredRef.current) return;
    const uid = (profile as { id?: string } | undefined)?.id;
    if (!uid || !composeConnections) return;
    const downConns = composeConnections.filter((c) => (c.consecutive_failures ?? 0) >= 3);
    if (downConns.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    const dismissKey = `inboria.disconnectedToast.dismissed:${uid}:${today}`;
    if (window.localStorage.getItem(dismissKey)) return;
    disconnectedToastFiredRef.current = true;
    window.localStorage.setItem(dismissKey, "1");
    toast({
      variant: "destructive",
      duration: 8000,
      title: t("inbox.disconnectedToastTitle", {
        count: downConns.length,
        defaultValue_one: "1 boîte déconnectée",
        defaultValue_other: "{{count}} boîtes déconnectées",
      }),
      description: t("inbox.disconnectedToastDescription", {
        defaultValue: "Cliquez pour reconnecter dans Paramètres.",
      }),
      action: (
        <Link
          href="/dashboard/parametres"
          className="inline-flex items-center justify-center rounded-md border border-white/30 bg-white/10 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-white/20 transition-colors"
        >
          {t("inbox.disconnectedToastAction", { defaultValue: "Reconnecter" })}
        </Link>
      ) as any,
    });
  }, [composeConnections, profile, toast, t]);

  const { data: myOrg } = useGetMyOrganisation();
  const { data: orgMembers } = useGetOrganisationMembers({ query: { enabled: !!(myOrg as any)?.id } as any });
  const assignEmailMut = useAssignEmail();
  const unassignEmailMut = useUnassignEmail();
  const isOrgAdmin = (myOrg as any)?.myRole === "admin";
  const [assigningInboxEmailId, setAssigningInboxEmailId] = useState<string | number | null>(null);

  const plan = (profile as any)?.plan;
  const { data: sharedMailboxes } = useGetSharedMailboxes({ query: { enabled: plan === "business" } as any });

  // Active SLA breaches (unresolved) — used to flag overdue rows in the inbox.
  const { data: slaBreachList } = useQuery<any[]>({
    queryKey: ["sla-breaches-active"],
    enabled: plan === "business",
    refetchInterval: 60_000,
    queryFn: async () => {
      const { supabase } = await import("@/lib/supabase");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) return [];
      const res = await fetch(`${import.meta.env.BASE_URL}api/sla/breaches`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
  });
  const slaBreachIds = useMemo(() => {
    const s = new Set<number>();
    for (const b of (slaBreachList || []) as any[]) {
      if (!b.resolvedAt) s.add(Number(b.emailId));
    }
    return s;
  }, [slaBreachList]);
  const [sharedPage, setSharedPage] = useState(1);
  const { data: sharedEmailsData, isLoading: sharedEmailsLoading, isFetching: sharedFetching } = useGetSharedMailboxEmails(
    selectedSharedMailboxId || "",
    { page: sharedPage, limit: 50 },
    { query: { enabled: !!selectedSharedMailboxId && inboxMode === "shared", placeholderData: (prev: any) => prev } as any }
  );
  const sharedPaged = sharedEmailsData as PaginatedSharedMailboxEmails | undefined;
  const sharedHasMore = sharedPaged ? sharedPage < (sharedPaged.totalPages ?? 1) : false;
  const sharedEmailsList = sharedPaged?.emails ?? [];

  useEffect(() => {
    setSharedPage(1);
  }, [selectedSharedMailboxId]);

  const loadMoreShared = useCallback(() => {
    if (sharedHasMore && !sharedFetching) {
      setSharedPage((p) => p + 1);
    }
  }, [sharedHasMore, sharedFetching]);
  const claimEmailMut = useClaimSharedEmail();
  const unclaimEmailMut = useUnclaimSharedEmail();

  const selectedCategoryId = filterCategory === "__uncategorized__"
    ? "uncategorized"
    : filterCategory !== "all"
    ? categoryCounts?.find((c) => c.categoryName === filterCategory)?.categoryId
    : undefined;

  const [emailPage, setEmailPage] = useState(1);
  const [accumulatedEmails, setAccumulatedEmails] = useState<Email[]>([]);
  const [totalEmails, setTotalEmails] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const prevFilterKey = useRef("");
  const currentFilterKey = `${filterPriority}|${searchQuery}|${filterCategory}|${crmFilter || ""}|${assigneeFilter || ""}`;
  useEffect(() => {
    if (prevFilterKey.current !== currentFilterKey) {
      prevFilterKey.current = currentFilterKey;
      setEmailPage(1);
      // Note: on ne vide PAS accumulatedEmails ici. La nouvelle requête
      // remplacera les emails (page === 1 → setAccumulatedEmails(newEmails)),
      // ce qui évite un flash "liste vide → liste pleine" pendant le fetch.
    }
  }, [currentFilterKey]);

  const { data: emailsData, isLoading: emailsLoading, isFetching: emailsFetching } = useListEmails({
    priority: filterPriority !== "all" ? (filterPriority as "urgent" | "moyen" | "faible") : undefined,
    categoryId: selectedCategoryId as any,
    q: searchQuery || undefined,
    page: emailPage,
    limit: 200,
    ...(crmFilter ? { crmFilter } : {}),
    ...(smartSort ? { sort: "smart" as const } : {}),
  }, { query: { placeholderData: (prev: any) => prev } as any });

  useEffect(() => {
    if (emailsData) {
      const paged = emailsData as PaginatedEmails;
      const newEmails = paged.emails || [];
      setTotalEmails(paged.total || 0);
      setTotalPages(paged.totalPages || 0);
      if (emailPage === 1) {
        setAccumulatedEmails(newEmails);
      } else {
        setAccumulatedEmails((prev) => {
          const existingIds = new Set(prev.map((e) => e.id));
          const unique = newEmails.filter((e) => !existingIds.has(e.id));
          return [...prev, ...unique];
        });
      }
    }
  }, [emailsData, emailPage]);

  const emails = accumulatedEmails;
  const hasMorePages = emailPage < totalPages;

  const updateEmail = useUpdateEmail();
  const deleteEmail = useDeleteEmail();
  const sendEmailMut = useSendEmail();
  const cancelPendingSendMut = useCancelPendingSend();
  const generateDraftMut = useGenerateDraft();
  const recategorizeMut = useRecategorizeUncategorized();
  const bulkUpdateMut = useBulkUpdateEmails();
  const restoreEmailMut = useRestoreEmail();
  const permanentDeleteMut = usePermanentDeleteEmail();

  const { data: trashCountData } = useListEmails({
    status: "trashed",
    page: 1,
    limit: 1,
  });
  const trashCountFromApi = (trashCountData as PaginatedEmails)?.total ?? 0;

  const { data: spamCountData } = useListEmails({
    status: "spam",
    page: 1,
    limit: 1,
  });
  const spamCountFromApi = (spamCountData as PaginatedEmails)?.total ?? 0;

  // Compteur total Reception (inbox perso, sans filtre) pour parité visuelle
  // avec les badges Spam/Corbeille.
  const { data: inboxCountData } = useListEmails({
    page: 1,
    limit: 1,
  });
  const inboxCountFromApi = (inboxCountData as PaginatedEmails)?.total ?? 0;

  // Nombre de boites partagees accessibles (count des mailboxes,
  // pas des emails — pas de endpoint d'agregat dispo).
  const sharedMailboxesCount = (sharedMailboxes as any[])?.length ?? 0;

  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isComposeFullscreen, setIsComposeFullscreen] = useState(false);
  const [composePrefill, setComposePrefill] = useState<{ to: string; subject: string; body: string } | null>(null);


  const isMobileViewport = typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches;

  useEffect(() => {
    if (isComposeOpen && isMobileViewport) setIsComposeFullscreen(true);
  }, [isComposeOpen, isMobileViewport]);

  // Ouvre le compose avec un brouillon Inboria pre-rempli. Declenche aussi
  // bien au montage (cas /dashboard?compose=1 depuis une autre route) que
  // sur evenement custom "inboria-open-compose" emis par le chat lorsque
  // l'utilisateur est deja sur le dashboard (les query params seuls ne
  // remontent pas le composant).
  useEffect(() => {
    const consumePrefillAndOpen = () => {
      try {
        const raw = sessionStorage.getItem("inboria.compose.prefill");
        if (raw) {
          const parsed = JSON.parse(raw);
          setComposePrefill({
            to: typeof parsed?.to === "string" ? parsed.to : "",
            subject: typeof parsed?.subject === "string" ? parsed.subject : "",
            body: typeof parsed?.body === "string" ? parsed.body : "",
          });
          sessionStorage.removeItem("inboria.compose.prefill");
        } else {
          setComposePrefill({ to: "", subject: "", body: "" });
        }
        setIsComposeOpen(true);
        const url = new URL(window.location.href);
        if (url.searchParams.has("compose")) {
          url.searchParams.delete("compose");
          window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
        }
      } catch {
        /* noop */
      }
    };

    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("compose") === "1") consumePrefillAndOpen();
    } catch {
      /* noop */
    }

    const handler = () => consumePrefillAndOpen();
    window.addEventListener("inboria-open-compose", handler);
    return () => window.removeEventListener("inboria-open-compose", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.has("emailId")) return;
      url.searchParams.delete("emailId");
      window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
    } catch {
      /* noop */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; emailId: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const contextMenuCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [contextMenu]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedIds(new Set());
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (selectedIds.size === 0) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-email-row]") || target.closest("[data-selection-bar]") || target.closest("[data-context-menu]")) return;
      setSelectedIds(new Set());
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [selectedIds.size > 0]);

  const isDraggingRef = useRef(false);
  const didDragRef = useRef(false);
  const dragStartIdRef = useRef<number | null>(null);
  const preSelectRef = useRef<Set<number>>(new Set());
  const autoScrollRaf = useRef<number>(0);
  const lastMouseYRef = useRef(0);

  const getRowIdFromPoint = useCallback((y: number, x: number): number | null => {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const row = (el as HTMLElement).closest?.("[data-row-id]");
    if (!row) return null;
    const id = Number(row.getAttribute("data-row-id"));
    return isNaN(id) ? null : id;
  }, []);

  const selectRange = useCallback((currentId: number) => {
    const rows = Array.from(document.querySelectorAll("[data-row-id]"));
    const ids = rows.map((r) => Number(r.getAttribute("data-row-id")));
    const startIdx = ids.indexOf(dragStartIdRef.current!);
    const endIdx = ids.indexOf(currentId);
    if (startIdx === -1 || endIdx === -1) return;
    const lo = Math.min(startIdx, endIdx);
    const hi = Math.max(startIdx, endIdx);
    const keep = new Set(preSelectRef.current);
    for (let i = lo; i <= hi; i++) keep.add(ids[i]);
    setSelectedIds(keep);
  }, []);

  useEffect(() => {
    const threshold = 60;
    const speed = 14;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      lastMouseYRef.current = e.clientY;
      if (!didDragRef.current) didDragRef.current = true;
      const hoverId = getRowIdFromPoint(e.clientY, e.clientX);
      if (hoverId !== null) selectRange(hoverId);

      cancelAnimationFrame(autoScrollRaf.current);
      const scroll = () => {
        if (!isDraggingRef.current) return;
        const y = lastMouseYRef.current;
        if (y > window.innerHeight - threshold) {
          window.scrollBy(0, speed);
          const id = getRowIdFromPoint(y, window.innerWidth / 2);
          if (id !== null) selectRange(id);
          autoScrollRaf.current = requestAnimationFrame(scroll);
        } else if (y < threshold) {
          window.scrollBy(0, -speed);
          const id = getRowIdFromPoint(y, window.innerWidth / 2);
          if (id !== null) selectRange(id);
          autoScrollRaf.current = requestAnimationFrame(scroll);
        }
      };
      scroll();
    };

    document.addEventListener("mousemove", handleMouseMove);
    return () => { document.removeEventListener("mousemove", handleMouseMove); cancelAnimationFrame(autoScrollRaf.current); };
  }, [getRowIdFromPoint, selectRange]);

  const handleDragSelectStart = useCallback((id: number) => {
    isDraggingRef.current = true;
    didDragRef.current = false;
    dragStartIdRef.current = id;
    setSelectedIds((prev) => { preSelectRef.current = new Set(prev); return prev; });
    const handleMouseUp = () => {
      isDraggingRef.current = false;
      cancelAnimationFrame(autoScrollRaf.current);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    document.addEventListener("mouseup", handleMouseUp);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, emailId: number) => {
    setSelectedIds((prev) => {
      if (prev.size > 0 && !prev.has(emailId)) {
        return new Set(prev).add(emailId);
      }
      return prev;
    });
    setContextMenu({ x: e.clientX, y: e.clientY, emailId });
  }, []);

  const selectedAccountEmail = (() => {
    if (selectedAccountId === "all" || !composeConnections) return null;
    const c = composeConnections.find((x) => String(x.id) === String(selectedAccountId));
    return c ? (c.email_address || "").toLowerCase() : null;
  })();

  const activeEmails = emails
    ?.slice()
    .filter((e: any) => {
      if (assigneeFilter) {
        const meId = (profile as any)?.id;
        if (assigneeFilter === "any") {
          if (!e.assignedTo) return false;
        } else if (assigneeFilter === "me") {
          if (!meId || String(e.assignedTo || "") !== String(meId)) return false;
        } else if (String(e.assignedTo || "") !== String(assigneeFilter)) {
          return false;
        }
        // Filtre assignee actif : on ignore le filtre par compte (souvent
        // persisté en localStorage) pour éviter un double-filtrage silencieux
        // qui masquerait des emails à l'utilisateur arrivant depuis Activité équipe.
        return true;
      }
      if (!selectedAccountEmail) return true;
      if (!e.recipient) return false;
      return recipientMatchesAddress(e.recipient, selectedAccountEmail);
    })
    .sort((a, b) => {
      // Smart sort: server already ordered by Inboria score; preserve order.
      if (smartSort) return 0;
      if (sortMode === "date_desc") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortMode === "date_asc") {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      const pOrder: Record<string, number> = { urgent: 0, moyen: 1, faible: 2 };
      return (pOrder[a.priority] ?? 2) - (pOrder[b.priority] ?? 2);
    });
  const selectedEmailFromList = emails?.find((e) => e.id === selectedEmailId);

  const { data: emailDetailData } = useQuery({
    queryKey: ["email-detail", selectedEmailId],
    queryFn: async () => {
      if (!selectedEmailId) return null;
      const { supabase } = await import("@/lib/supabase");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) return null;
      const resp = await fetch(`${import.meta.env.BASE_URL}api/emails/${selectedEmailId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) return null;
      return resp.json();
    },
    enabled: !!selectedEmailId,
    staleTime: 30_000,
  });

  const selectedEmail = emailDetailData
    ? { ...selectedEmailFromList, ...emailDetailData }
    : selectedEmailFromList;

  useEffect(() => {
    if (selectedEmailId) {
      window.scrollTo({ top: 0 });
    }
  }, [selectedEmailId]);

  const loadMoreRef = useRef<HTMLDivElement>(null);
  const loadMore = useCallback(() => {
    if (hasMorePages && !emailsFetching) {
      setEmailPage((p) => p + 1);
    }
  }, [hasMorePages, emailsFetching]);

  useEffect(() => {
    if (hasMorePages && !emailsFetching) {
      const t = setTimeout(() => setEmailPage((p) => p + 1), 50);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [hasMorePages, emailsFetching]);

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { threshold: 0, rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  const selectionMode = selectedIds.size > 0;

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!activeEmails) return;
    if (selectedIds.size === activeEmails.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(activeEmails.map((e) => e.id)));
    }
  };

  const handleBulkAction = (action: "delete" | "archive" | "read") => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    bulkUpdateMut.mutate(
      { data: { ids, action } },
      {
        onSuccess: (result) => {
          if (action !== "read") {
            setSelectedIds(new Set());
          }
          if (action === "read") {
            const idSet = new Set(ids);
            setAccumulatedEmails((prev) => prev.map((e) => idSet.has(e.id) ? { ...e, status: "read" } : e));
            queryClient.invalidateQueries({ queryKey: getGetCategoryCountsQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          } else {
            invalidateAll();
          }
          const labels: Record<string, string> = { delete: t("inbox.bulkDeleted", { count: result.affected }), archive: t("inbox.bulkArchived", { count: result.affected }), read: t("inbox.bulkRead", { count: result.affected }) };
          toast({ title: labels[action] });
        },
        onError: () => {
          toast({ variant: "destructive", title: t("common.error") });
        },
      }
    );
  };

  const invalidateAll = () => {
    setEmailPage(1);
    setAccumulatedEmails([]);
    queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetCategoryCountsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetInboxHealthQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
    queryClient.refetchQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    // Refetch the open email detail too — otherwise stale detail data
    // overrides the freshly-fetched list values when displayed.
    queryClient.invalidateQueries({ queryKey: ["email-detail"] });
  };

  const handleMarkAsRead = (id: number) => {
    updateEmail.mutate(
      { id, data: { status: "read" } },
      { onSuccess: invalidateAll }
    );
  };

  const blockSenderMut = useBlockSender();
  const handleBlockSender = (id: number) => {
    const email = (emails as any[]).find((e: any) => e.id === id);
    const addr = (email?.senderEmail || "").trim();
    if (!addr) {
      toast({ title: t("junk.blockFailed"), description: t("junk.blockNoEmail"), variant: "destructive" });
      return;
    }
    const firstConn = (composeConnections || []).find((c: any) => c.status !== "disconnected") || (composeConnections || [])[0];
    if (!firstConn?.id) {
      toast({ title: t("junk.blockFailed"), description: t("junk.blockNoConnection"), variant: "destructive" });
      return;
    }
    blockSenderMut.mutate(
      { data: { email: addr, connectionId: firstConn.id, scope: "all_accounts" } },
      {
        onSuccess: () => { toast({ title: t("junk.blocked"), description: addr }); invalidateAll(); },
        onError: () => toast({ title: t("junk.blockFailed"), variant: "destructive" }),
      },
    );
  };

  const handleArchive = (id: number) => {
    updateEmail.mutate(
      { id, data: { status: "archived" } },
      {
        onSuccess: () => {
          setSelectedEmailId(null);
          invalidateAll();
          toast({ title: t("inbox.emailArchived") });
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteEmail.mutate(
      { id },
      {
        onSuccess: () => {
          setSelectedEmailId(null);
          invalidateAll();
          toast({ title: t("inbox.emailDeleted") });
        },
        onError: () => {
          toast({ variant: "destructive", title: t("common.error"), description: t("inbox.sendError") });
        },
      }
    );
  };

  // Task #244 — Inbox keyboard shortcuts (Superhuman-style). Disabled while
  // the user types in inputs/textareas/contenteditable, while modifier keys
  // are held (so Cmd+R reload still works), and on the classic mirror.
  useEffect(() => {
    if (routeLocation.includes("inbox-classic")) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        if (target.isContentEditable) return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const el = document.querySelector<HTMLInputElement>('input[type="search"], input[placeholder*="echerch" i], input[placeholder*="earch" i]');
        el?.focus();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const list = activeEmails || [];
      if (list.length === 0) return;
      const currentIdx = selectedEmailId ? list.findIndex((x: any) => x.id === selectedEmailId) : -1;
      const k = e.key.toLowerCase();
      if (k === "j" || k === "arrowdown") {
        e.preventDefault();
        const next = list[Math.min(list.length - 1, currentIdx + 1)] || list[0];
        if (next) setSelectedEmailId(next.id);
      } else if (k === "k" || k === "arrowup") {
        e.preventDefault();
        const prev = list[Math.max(0, currentIdx - 1)] || list[0];
        if (prev) setSelectedEmailId(prev.id);
      } else if (k === "e" && selectedEmailId) {
        e.preventDefault();
        handleArchive(selectedEmailId);
      } else if (k === "r" && selectedEmailId) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("inbox-reply-shortcut", { detail: { emailId: selectedEmailId } }));
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activeEmails, selectedEmailId, routeLocation]);

  const handleUpdatePriority = (id: number, priority: string) => {
    updateEmail.mutate(
      { id, data: { priority } as any },
      {
        onSuccess: () => {
          invalidateAll();
          toast({ title: t("inbox.priorityChanged") });
        },
      }
    );
  };

  const handleUpdateCategory = (id: number, categoryId: string) => {
    updateEmail.mutate(
      { id, data: { categoryId: categoryId === "none" ? null : parseInt(categoryId) } },
      {
        onSuccess: () => {
          invalidateAll();
          toast({ title: t("inbox.categoryUpdated") });
        },
      }
    );
  };

  const handleUpdateProject = (id: number, projectId: string) => {
    updateEmail.mutate(
      { id, data: { projectId: projectId === "none" ? null : projectId } as any },
      {
        onSuccess: () => {
          invalidateAll();
          toast({ title: t("inbox.projectUpdated") });
        },
      }
    );
  };

  const handleAssign = (emailId: number, userId: string) => {
    assignEmailMut.mutate(
      { emailId, data: { assignTo: userId } },
      {
        onSuccess: (result) => {
          invalidateAll();
          toast({ title: t("inbox.assignSuccess"), description: `${(result as any).assignedToName || ""}` });
        },
        onError: () => {
          toast({ variant: "destructive", title: t("common.error") });
        },
      }
    );
  };

  const handleUnassign = (emailId: number) => {
    unassignEmailMut.mutate(
      { emailId },
      {
        onSuccess: () => {
          invalidateAll();
          toast({ title: t("inbox.unassignSuccess") });
        },
        onError: () => {
          toast({ variant: "destructive", title: t("common.error") });
        },
      }
    );
  };

  const createTaskMut = useCreateTask();
  const handleCreateTask = async (emailId: number, title: string, projectId?: string, assigneeUserIds?: string[]) => {
    const assignees = assigneeUserIds && assigneeUserIds.length > 0 ? assigneeUserIds : [null];
    try {
      for (const assignee of assignees) {
        await createTaskMut.mutateAsync({
          data: {
            title,
            emailId,
            projectId: projectId || undefined,
            ...(assignee ? { assignedToUserId: assignee } : {}),
          } as any,
        });
      }
      if (projectId) {
        await new Promise<void>((resolve) => {
          updateEmail.mutate(
            { id: emailId, data: { projectId } },
            { onSuccess: () => { invalidateAll(); resolve(); }, onError: () => resolve() }
          );
        });
      } else {
        invalidateAll();
      }
      queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
      toast({
        title:
          assignees.length > 1
            ? t("tasks.tasksCreated", { count: assignees.length, defaultValue: `${assignees.length} tâches créées` })
            : t("inbox.taskCreated"),
      });
    } catch {
      toast({ variant: "destructive", title: t("common.error"), description: t("inbox.taskCreateError") });
    }
    return;
  };

  const handleSendReply = (to: string, subject: string, body: string, replyToEmailId?: number, attachments?: UploadedFile[], connectionId?: string, projectId?: string, markHandledOfEmailId?: number) => {
    const uploadIds = attachments?.map((a) => a.uploadId).filter(Boolean);
    const data: any = {
      to,
      subject,
      body,
      replyToEmailId: replyToEmailId ?? null,
      attachments: uploadIds && uploadIds.length > 0 ? uploadIds : undefined,
    };
    if (connectionId) data.connectionId = connectionId;
    if (projectId) data.projectId = projectId;
    if (markHandledOfEmailId) data.markHandledOfEmailId = markHandledOfEmailId;

    let cancelled = false;
    const pendingId = (typeof crypto !== "undefined" && (crypto as any).randomUUID)
      ? (crypto as any).randomUUID() as string
      : `pend-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const performSend = () => {
      if (cancelled) return;
      sendEmailMut.mutate(
        { data },
        {
          onSuccess: (resp: any) => {
            invalidateAll();
            if (resp?.appointmentId) {
              toast({ title: t("inbox.emailSent"), description: t("inbox.appointmentProposed", "Rendez-vous proposé créé dans l'agenda") });
            } else {
              toast({ title: t("inbox.emailSent") });
            }
          },
          onError: (err: any) => {
            const msg = err?.data?.error || err?.message || t("inbox.sendError");
            toast({ variant: "destructive", title: t("common.error"), description: msg });
          },
        }
      );
    };
    const timer = setTimeout(performSend, 10000);
    toast({
      title: t("wave1.undoSendToast"),
      duration: 10000,
      action: (
        <ToastAction
          altText={t("wave1.undoSendAction") as string}
          onClick={() => {
            cancelled = true;
            clearTimeout(timer);
            // Fire-and-forget audit so other devices know the send was cancelled.
            cancelPendingSendMut.mutate(
              { data: { pendingId } },
              { onError: () => { /* audit-only; never surface */ } }
            );
            toast({ title: t("wave1.undoCancelled") });
          }}
          data-testid="button-undo-send"
        >
          {t("wave1.undoSendAction")}
        </ToastAction>
      ),
    });
  };

  const handleComposeSend = useCallback((p: ComposeSendPayload) => {
    if (!p.to.trim() || !p.subject.trim() || !p.body.trim()) return;
    const payload: any = {
      to: p.to,
      subject: p.subject,
      body: p.body,
      replyToEmailId: null,
      attachments: p.attachments.length > 0 ? p.attachments.map((a) => a.uploadId) : undefined,
    };
    if (p.connectionId) payload.connectionId = p.connectionId;
    if (p.projectId) payload.projectId = p.projectId;
    sendEmailMut.mutate(
      { data: payload },
      {
        onSuccess: (resp: any) => {
          invalidateAll();
          setIsComposeOpen(false);
          setIsComposeFullscreen(false);
          if (resp?.appointmentId) {
            toast({ title: t("inbox.emailSent"), description: t("inbox.appointmentProposed", "Rendez-vous proposé créé dans l'agenda") });
          } else {
            toast({ title: t("inbox.emailSent") });
          }
        },
        onError: (err: any) => {
          const msg = err?.data?.error || err?.message || t("inbox.sendError");
          toast({ variant: "destructive", title: t("common.error"), description: msg });
        },
      }
    );
  }, [sendEmailMut, invalidateAll, t]);

  const handleGenerateDraft = (emailId: number, callback: (draft: string) => void) => {
    generateDraftMut.mutate(
      { data: { emailId } },
      {
        onSuccess: (data) => {
          callback(data.draft);
          queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
          toast({ title: t("inbox.draftGenerated") });
        },
        onError: () => {
          toast({ title: t("inbox.draftError") });
        },
      }
    );
  };

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
        invalidateAll();
        const count = data.synced || 0;
        if (count > 0) {
          toast({ title: t("inbox.syncComplete"), description: t("inbox.syncNewEmails", { count }) });
        }
      } else {
        // Cas frequent pour un nouvel utilisateur (ex. Richard Martin) :
        // aucun compte email n'a encore ete connecte. On affiche alors
        // un message neutre + invite a se rendre dans Reglages plutot
        // qu'une grosse erreur rouge effrayante.
        const isNoConnection =
          typeof data?.error === "string" && /aucun compte email connecte/i.test(data.error);
        if (isNoConnection) {
          toast({
            title: "Aucune boîte connectée",
            description: "Connectez Gmail ou Outlook dans Réglages › Connexions pour synchroniser vos mails.",
          });
        } else {
          toast({ variant: "destructive", title: t("common.error"), description: data.error });
        }
      }
    } catch {
      toast({ variant: "destructive", title: t("common.error") });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClaimEmail = (emailId: number) => {
    claimEmailMut.mutate(
      { emailId: emailId.toString() },
      {
        onSuccess: () => {
          queryClient.invalidateQueries();
          toast({ title: t("inbox.claim") });
        },
        onError: () => {
          toast({ variant: "destructive", title: t("common.error") });
        },
      }
    );
  };

  const handleUnclaimEmail = (emailId: number) => {
    unclaimEmailMut.mutate(
      { emailId: emailId.toString() },
      {
        onSuccess: () => {
          queryClient.invalidateQueries();
          toast({ title: t("inbox.unclaim") });
        },
        onError: () => {
          toast({ variant: "destructive", title: t("common.error") });
        },
      }
    );
  };

  const handleAssignInboxEmail = async (emailId: number, assignTo: string) => {
    if (!assignTo) return;
    setAssigningInboxEmailId(null);
    try {
      await assignEmailMut.mutateAsync({ emailId, data: { assignTo } });
      queryClient.invalidateQueries();
      toast({ title: t("sharedMailboxes.assignSuccess") });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: e?.response?.data?.error || t("sharedMailboxes.assignError"),
      });
    }
  };

  const hasSharedMailboxes = plan === "business" && sharedMailboxes && (sharedMailboxes as any[]).length > 0;

  if (selectedEmail) {
    return (
      <DashboardLayout>
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5 flex flex-col md:flex-row gap-5">
          <div className="flex-1 min-w-0 max-w-[900px]">
            <EmailDetail
              email={selectedEmail}
              onBack={() => setSelectedEmailId(null)}
              onMarkRead={handleMarkAsRead}
              onArchive={handleArchive}
              onDelete={handleDelete}
              onUpdatePriority={handleUpdatePriority}
              onUpdateCategory={handleUpdateCategory}
              onUpdateProject={handleUpdateProject}
              onSendReply={handleSendReply}
              isSending={sendEmailMut.isPending}
              onGenerateDraft={handleGenerateDraft}
              isDrafting={generateDraftMut.isPending}
              categories={categoryCounts || []}
              projects={projects || []}
              currentUserId={(profile as any)?.id}
              orgMembers={(orgMembers as any[]) || []}
              onAssign={handleAssign}
              onUnassign={handleUnassign}
              onCreateTask={handleCreateTask}
              connections={composeConnections}
              sharedMailboxes={sharedMailboxes}
            />
          </div>
          {/* Panneau CRM côté droit en vue détail.
              Spécification (task #129) :
              - HubSpot seul connecté → on affiche HubSpot
              - Pipedrive seul connecté → on affiche Pipedrive
              - Les DEUX connectés → un sélecteur (onglets) permet de
                basculer ; HubSpot est par défaut.
              Les deux panneaux ne s'affichent JAMAIS simultanément.
              Le bouton "masquer" ferme la branche correspondante ; la
              recharge de la page rétablit l'état par défaut. */}
          {((hasHubspot && !detailHubspotPanelHidden && activeCrmDetailPanel === "hubspot") ||
            (hasPipedrive && !detailPipedrivePanelHidden && activeCrmDetailPanel === "pipedrive") ||
            (hasSalesforce && !detailSalesforcePanelHidden && activeCrmDetailPanel === "salesforce") ||
            (hasOdoo && !detailOdooPanelHidden && activeCrmDetailPanel === "odoo")) && (
            <div className="w-full md:w-[280px] shrink-0 space-y-2">
              {/* Onglets de bascule — affichés dès que 2+ CRM coexistent.
                  Chaque onglet est rendu uniquement si le CRM correspondant
                  est connecté. Le clic sur un onglet bascule la sélection
                  exclusive (un seul panneau actif à la fois). */}
              {[hasHubspot, hasPipedrive, hasSalesforce, hasOdoo].filter(Boolean).length >= 2 && (
                <div
                  className="flex items-center gap-1 bg-card rounded-lg border border-border p-1"
                  data-testid="tabs-crm-detail-panel"
                >
                  {hasHubspot && (
                    <button
                      type="button"
                      onClick={() => setActiveCrmDetailPanel("hubspot")}
                      className={`flex-1 text-[10px] uppercase tracking-wider rounded px-2 py-1 ${
                        activeCrmDetailPanel === "hubspot"
                          ? "bg-orange-500/20 text-orange-400"
                          : "text-[#b8c5d6] hover:text-white"
                      }`}
                      data-testid="tab-crm-detail-hubspot"
                    >
                      HubSpot
                    </button>
                  )}
                  {hasPipedrive && (
                    <button
                      type="button"
                      onClick={() => setActiveCrmDetailPanel("pipedrive")}
                      className={`flex-1 text-[10px] uppercase tracking-wider rounded px-2 py-1 ${
                        activeCrmDetailPanel === "pipedrive"
                          ? "bg-primary/20 text-primary"
                          : "text-[#b8c5d6] hover:text-white"
                      }`}
                      data-testid="tab-crm-detail-pipedrive"
                    >
                      Pipedrive
                    </button>
                  )}
                  {hasSalesforce && (
                    <button
                      type="button"
                      onClick={() => setActiveCrmDetailPanel("salesforce")}
                      className={`flex-1 text-[10px] uppercase tracking-wider rounded px-2 py-1 ${
                        activeCrmDetailPanel === "salesforce"
                          ? "bg-sky-500/20 text-sky-400"
                          : "text-[#b8c5d6] hover:text-white"
                      }`}
                      data-testid="tab-crm-detail-salesforce"
                    >
                      Salesforce
                    </button>
                  )}
                  {hasOdoo && (
                    <button
                      type="button"
                      onClick={() => setActiveCrmDetailPanel("odoo")}
                      className={`flex-1 text-[10px] uppercase tracking-wider rounded px-2 py-1 ${
                        activeCrmDetailPanel === "odoo"
                          ? "bg-indigo-500/20 text-indigo-400"
                          : "text-[#b8c5d6] hover:text-white"
                      }`}
                      data-testid="tab-crm-detail-odoo"
                    >
                      Odoo
                    </button>
                  )}
                </div>
              )}
              {hasHubspot && !detailHubspotPanelHidden && activeCrmDetailPanel === "hubspot" && (
                <HubspotContextPanel
                  senderEmail={
                    extractEmailAddress(selectedEmail.senderEmail || selectedEmail.sender) || null
                  }
                  selectedEmailId={Number(selectedEmail.id)}
                  selectedSubject={selectedEmail?.subject ?? null}
                  selectedBody={selectedEmail?.body ?? null}
                  selectedDate={selectedEmail?.created_at ?? selectedEmail?.createdAt ?? null}
                  collapsed={crmPanelCollapsed}
                  onToggleCollapsed={() => setCrmPanelCollapsed((v) => !v)}
                  onHide={() => setDetailHubspotPanelHidden(true)}
                />
              )}
              {hasPipedrive && !detailPipedrivePanelHidden && activeCrmDetailPanel === "pipedrive" && (
                <PipedriveContextPanel
                  senderEmail={
                    extractEmailAddress(selectedEmail.senderEmail || selectedEmail.sender) || null
                  }
                  selectedEmailId={Number(selectedEmail.id)}
                  selectedSubject={selectedEmail?.subject ?? null}
                  selectedBody={selectedEmail?.body ?? null}
                  selectedDate={selectedEmail?.created_at ?? selectedEmail?.createdAt ?? null}
                  collapsed={crmPanelCollapsed}
                  onToggleCollapsed={() => setCrmPanelCollapsed((v) => !v)}
                  onHide={() => setDetailPipedrivePanelHidden(true)}
                />
              )}
              {hasSalesforce && !detailSalesforcePanelHidden && activeCrmDetailPanel === "salesforce" && (
                <SalesforceContextPanel
                  senderEmail={
                    extractEmailAddress(selectedEmail.senderEmail || selectedEmail.sender) || null
                  }
                  selectedEmailId={Number(selectedEmail.id)}
                  selectedSubject={selectedEmail?.subject ?? null}
                  selectedBody={selectedEmail?.body ?? null}
                  selectedDate={selectedEmail?.created_at ?? selectedEmail?.createdAt ?? null}
                  collapsed={crmPanelCollapsed}
                  onToggleCollapsed={() => setCrmPanelCollapsed((v) => !v)}
                  onHide={() => setDetailSalesforcePanelHidden(true)}
                />
              )}
              {hasOdoo && !detailOdooPanelHidden && activeCrmDetailPanel === "odoo" && (
                <OdooContextPanel
                  senderEmail={
                    extractEmailAddress(selectedEmail.senderEmail || selectedEmail.sender) || null
                  }
                  selectedEmailId={Number(selectedEmail.id)}
                  selectedSubject={selectedEmail?.subject ?? null}
                  selectedBody={selectedEmail?.body ?? null}
                  selectedDate={selectedEmail?.created_at ?? selectedEmail?.createdAt ?? null}
                  collapsed={crmPanelCollapsed}
                  onToggleCollapsed={() => setCrmPanelCollapsed((v) => !v)}
                  onHide={() => setDetailOdooPanelHidden(true)}
                />
              )}
            </div>
          )}
        </div>
      </DashboardLayout>
    );
  }

  const displayedEmailCount = activeEmails?.length || 0;

  const assigneePageTitle = (() => {
    if (!assigneeFilter) return null;
    if (assigneeFilter === "me") {
      return t("inbox.assignedPageMine", { defaultValue: "Mes emails assignés" });
    }
    if (assigneeFilter === "any") {
      return t("inbox.assignedPageTeam", { defaultValue: "Emails assignés à l'équipe" });
    }
    const m = (orgMembers as any[] | undefined)?.find((x: any) => String(x.userId) === String(assigneeFilter));
    const name = m?.fullName || m?.email || t("inbox.assigneeFilterMember", { defaultValue: "ce membre" });
    return t("inbox.assignedPageMember", { name, defaultValue: `Assignés à ${name}` });
  })();

  // Cache quand assigneeFilter actif : /category-counts couvre toute
  // l'org, pas filtre par assignee, donc afficher serait trompeur.
  const categoriesPanel = !assigneeFilter ? (
    <>
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-[10px] font-medium text-[#b8c5d6] uppercase tracking-wider">
          {t("inbox.category")}
        </h3>
        {(() => {
          const summaryData = summary as { uncategorizedCount?: number } | undefined;
          const uncategorizedCount = summaryData?.uncategorizedCount || 0;
          if (uncategorizedCount === 0) return null;
          return (
            <button
              onClick={() => {
                recategorizeMut.mutate({ data: { lang } }, {
                  onSuccess: (data: any) => {
                    invalidateAll();
                    toast({
                      title: t("inbox.recategorizeSuccess", { count: data.recategorized }),
                      description: data.created?.length > 0 ? data.created.join(", ") : undefined,
                    });
                  },
                  onError: () => {
                    toast({ title: t("common.error"), variant: "destructive" });
                  },
                });
              }}
              disabled={recategorizeMut.isPending}
              className="flex items-center gap-1 text-[9px] text-primary hover:text-white transition-colors disabled:opacity-50"
              title={t("inbox.recategorize")}
            >
              {recategorizeMut.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Tags className="w-3 h-3" />
              )}
              <span>{uncategorizedCount} {t("inbox.uncategorized")}</span>
            </button>
          );
        })()}
      </div>
      {categoriesLoading ? (
        <div className="py-2 text-center">
          <Loader2 className="w-4 h-4 text-primary/60 animate-spin mx-auto" />
        </div>
      ) : (
        <div className="space-y-0.5">
          {(() => {
            const summaryData = summary as { uncategorizedCount?: number } | undefined;
            const uncategorizedCount = summaryData?.uncategorizedCount || 0;
            const hasItems = uncategorizedCount > 0;
            const isSelected = filterCategory === "__uncategorized__";
            return (
              <div
                className={`flex items-center justify-between py-1 px-1.5 rounded transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-primary/10 text-primary"
                    : hasItems
                      ? "hover:bg-white/[0.04] text-primary"
                      : "hover:bg-white/[0.04] text-muted-foreground"
                }`}
                onClick={() => setFilterCategory(isSelected ? "all" : "__uncategorized__")}
              >
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${hasItems ? "bg-primary" : "bg-white/20"}`} />
                  <span className="text-[11px]">{t("inbox.uncategorized")}</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${hasItems ? "bg-primary/15 text-primary" : "bg-white/[0.06] text-muted-foreground"}`}>
                  {uncategorizedCount}
                </span>
              </div>
            );
          })()}
          {categoryCounts
            ?.filter((cat) => {
              const JUNK = ["non classé", "non classe", "uncategorized", "niet geclassificeerd"];
              return !JUNK.includes((cat.categoryName || "").toLowerCase());
            })
            .map((cat) => (
            <div
              key={cat.categoryId}
              className={`flex items-center justify-between py-1 px-1.5 rounded transition-colors cursor-pointer ${filterCategory === cat.categoryName ? "bg-primary/10 text-primary" : "hover:bg-white/[0.04]"}`}
              onClick={() => setFilterCategory(filterCategory === cat.categoryName ? "all" : cat.categoryName)}
            >
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span className="text-[11px] text-[#b8c5d6]">{translateCategoryName(cat.categoryName, lang)}</span>
              </div>
              <span className="text-[10px] text-[#b8c5d6] bg-white/[0.06] px-1.5 py-0.5 rounded">
                {cat.count}
              </span>
            </div>
          ))}
          {categoryCounts?.length === 0 && (
            <p className="text-[11px] text-[#b8c5d6]/60 italic py-1.5">{t("inbox.noEmails")}</p>
          )}
        </div>
      )}
    </>
  ) : undefined;

  return (
    <DashboardLayout rightSidebar={categoriesPanel}>
      <div className="flex flex-col h-full">
        {assigneePageTitle && (
          <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-4 pb-2">
            <BackToInboxButton />
            <div className="mt-1">
              <h1 className="text-[16px] font-semibold text-white tracking-tight flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-primary" />
                {assigneePageTitle}
              </h1>
              <p className="text-[12px] text-[#b8c5d6] mt-0.5">
                {t("inbox.assignedPageCount", { count: displayedEmailCount, defaultValue: `${displayedEmailCount} email(s)` })}
              </p>
            </div>
          </div>
        )}
        {/* Toute la barre d'outils de l'inbox (recherche, actualiser, nouvel
            email, onglets Reception/Boites partagees/Spam/Corbeille, selecteur
            de compte, filtres priorite/categorie/tri/CRM) est masquee quand
            la page est utilisee comme vue dediee "Mes emails assignes" /
            "Equipe" / "Membre". Sans cela, l'utilisateur voyait tout le
            chrome de l'inbox au-dessus de sa liste filtree, ce qui rendait
            la page indistinguable de la reception et inutilisable comme vue
            dediee — cf. retour utilisateur du 1 mai 2026. */}
        {!assigneeFilter && (
        <div className="sticky top-16 z-30 bg-background pt-4 pb-2.5 border-b border-border">
          <div className="flex items-center gap-2 mb-2.5 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#b8c5d6]" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t("inbox.searchPlaceholder")}
                className="pl-9 bg-card border-border text-white placeholder:text-[#b8c5d6]/50 h-8 text-[12px]"
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#b8c5d6] hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-8 text-[11px] bg-transparent border-border text-[#b8c5d6] hover:text-white hover:bg-white/[0.04]"
              onClick={handleSync}
              disabled={isSyncing}
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">{isSyncing ? t("inbox.refreshing") : t("inbox.refresh")}</span>
            </Button>

            <Dialog open={isComposeOpen} onOpenChange={(open) => {
              setIsComposeOpen(open);
              if (!open) {
                setIsComposeFullscreen(false);
                setComposePrefill(null);
              }
            }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5 h-8 text-[11px]">
                  <PenSquare className="w-3 h-3" />
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
                    projects={(projects as any[]) || []}
                    isPending={sendEmailMut.isPending}
                    onSend={handleComposeSend}
                    initialTo={composePrefill?.to}
                    initialSubject={composePrefill?.subject}
                    initialBody={composePrefill?.body}
                  />
                )}
              </DialogContent>
            </Dialog>

          </div>

          <div className="flex flex-wrap items-center gap-1.5 gap-y-2 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 mb-2">
              <button
                onClick={() => {
                  setInboxMode("personal");
                  setSelectedSharedMailboxId(null);
                  // Réinitialise le filtre CRM pour que cliquer « Réception »
                  // ramène TOUJOURS la liste complète de la boîte.
                  setCrmFilter(null);
                }}
                className={`inline-flex items-center justify-center gap-1 w-[140px] h-7 text-[11px] rounded-md font-medium transition-colors ${
                  inboxMode === "personal"
                    ? "bg-primary/15 text-primary border border-primary/20"
                    : "text-[#b8c5d6] border border-[#1f2937] hover:text-white hover:border-[#b8c5d6]/30"
                }`}
              >
                <Inbox className="w-3 h-3" />
                {t("inbox.title")}
                {inboxCountFromApi > 0 && (
                  <span className="text-[10px] bg-white/10 text-white px-1.5 py-0.5 rounded-full">{inboxCountFromApi}</span>
                )}
              </button>
              {hasSharedMailboxes && (
                <button
                  onClick={() => {
                    setInboxMode("shared");
                    // Idem Réception : on lève le filtre CRM en basculant sur
                    // boîte partagée pour ne pas masquer des emails.
                    setCrmFilter(null);
                    const mbs = sharedMailboxes as any[];
                    if (mbs?.length > 0 && !selectedSharedMailboxId) {
                      setSelectedSharedMailboxId(mbs[0].id);
                    }
                  }}
                  className={`inline-flex items-center justify-center gap-1 w-[140px] h-7 text-[11px] rounded-md font-medium transition-colors ${
                    inboxMode === "shared"
                      ? "bg-primary/15 text-primary border border-primary/20"
                      : "text-[#b8c5d6] border border-[#1f2937] hover:text-white hover:border-[#b8c5d6]/30"
                  }`}
                >
                  <Users className="w-3 h-3" />
                  {t("inbox.sharedMailboxShort", "Partagées")}
                  {sharedMailboxesCount > 0 && (
                    <span className="text-[10px] bg-white/10 text-white px-1.5 py-0.5 rounded-full">{sharedMailboxesCount}</span>
                  )}
                </button>
              )}
              <Link
                href="/dashboard/indesirables"
                className="inline-flex items-center justify-center gap-1 w-[140px] h-7 text-[11px] rounded-md font-medium transition-colors text-[#b8c5d6] border border-[#1f2937] hover:text-white hover:border-[#b8c5d6]/30"
              >
                <ShieldAlert className="w-3 h-3" />
                {t("inbox.spamShort", "Indésirables")}
                {spamCountFromApi > 0 && (
                  <span className="text-[10px] bg-white/10 text-white px-1.5 py-0.5 rounded-full">{spamCountFromApi}</span>
                )}
              </Link>
              <Link
                href="/dashboard/corbeille"
                className="inline-flex items-center justify-center gap-1 w-[140px] h-7 text-[11px] rounded-md font-medium transition-colors text-[#b8c5d6] border border-[#1f2937] hover:text-white hover:border-[#b8c5d6]/30"
              >
                <Trash2 className="w-3 h-3" />
                {t("inbox.trash")}
                {trashCountFromApi > 0 && (
                  <span className="text-[10px] bg-white/10 text-white px-1.5 py-0.5 rounded-full">{trashCountFromApi}</span>
                )}
              </Link>
              {inboxMode === "personal" && (composeConnections?.length || 0) >= 2 && (
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                  <SelectTrigger className="w-[140px] h-7 bg-card border-border text-[#b8c5d6] text-[11px]">
                    <SelectValue placeholder={t("inbox.accountFilter")} />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="all">{t("inbox.allAccounts")}</SelectItem>
                    {composeConnections?.map((c) => {
                      const badge = resolveMailboxBadge({ recipient: c.email_address }, composeConnections, undefined);
                      const isDown = (c.consecutive_failures ?? 0) >= 3;
                      return (
                        <SelectItem key={c.id} value={String(c.id)}>
                          <span className="inline-flex items-center gap-1.5">
                            {isDown ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            ) : (
                              badge && <span className={`w-1.5 h-1.5 rounded-full ${badge.dotClass}`} />
                            )}
                            <span className={isDown ? "text-red-400" : ""}>{c.email_address}</span>
                            {isDown && <AlertCircle className="w-3 h-3 text-red-400 ml-1" />}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
              {inboxMode === "personal" && (() => {
                const downConns = (composeConnections || []).filter((c) => (c.consecutive_failures ?? 0) >= 3);
                if (downConns.length === 0) return null;
                return (
                  <TooltipProvider delayDuration={150}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link
                          href="/dashboard/parametres"
                          className="inline-flex items-center gap-1 ml-1 px-2 py-0.5 rounded-md border border-red-500/30 bg-red-500/10 text-red-400 text-[11px] font-medium hover:bg-red-500/20 transition-colors"
                          aria-label={t("inbox.disconnectedAccountsLabel", { count: downConns.length, defaultValue_one: "1 boîte hors service", defaultValue_other: "{{count}} boîtes hors service" })}
                        >
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>{t("inbox.disconnectedAccountsLabel", { count: downConns.length, defaultValue_one: "1 boîte hors service", defaultValue_other: "{{count}} boîtes hors service" })}</span>
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-[11px] font-medium mb-1">
                          {t("inbox.disconnectedTooltipTitle", { defaultValue: "Compte(s) déconnecté(s)" })}
                        </p>
                        <ul className="text-[11px] text-[#b8c5d6] space-y-0.5">
                          {downConns.map((c) => (
                            <li key={c.id}>• {c.email_address}</li>
                          ))}
                        </ul>
                        <p className="text-[11px] mt-1.5 text-[#b8c5d6]">
                          {t("inbox.disconnectedTooltipCta", { defaultValue: "Cliquez pour reconnecter dans Paramètres." })}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })()}
              {inboxMode === "shared" && (sharedMailboxes as any[])?.length > 1 && (
                <Select value={selectedSharedMailboxId || ""} onValueChange={setSelectedSharedMailboxId}>
                  <SelectTrigger className="w-[140px] h-7 bg-card border-border text-[#b8c5d6] text-[11px]">
                    <SelectValue placeholder={t("inbox.sharedMailbox")} />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {(sharedMailboxes as any[])?.map((mb: any) => (
                      <SelectItem key={mb.id} value={mb.id}>{mb.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

          <div className="flex flex-wrap items-center gap-1.5 gap-y-2 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8">
              {[
                { value: "all", label: t("inbox.priorities.all", "Toutes") },
                { value: "urgent", label: t("inbox.priorities.urgent") },
                { value: "moyen", label: t("inbox.priorities.medium") },
                { value: "faible", label: t("inbox.priorities.low") },
              ].map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilterPriority(f.value)}
                  className={`inline-flex items-center justify-center w-[140px] h-7 text-[11px] rounded-md font-medium transition-colors ${
                    filterPriority === f.value
                      ? "bg-primary/15 text-primary border border-primary/20"
                      : "text-[#b8c5d6] border border-[#1f2937] hover:text-white hover:border-[#b8c5d6]/30"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

          <div className="flex flex-wrap items-center gap-1.5 gap-y-2 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 mt-2">
              <button
                onClick={() => setSmartSort((v) => !v)}
                title={
                  smartSort
                    ? t("inboriaSort.smartTooltipOn", "Tri intelligent activé : Inboria pousse en haut les emails stratégiques.")
                    : t("inboriaSort.smartTooltipOff", "Tri intelligent désactivé.")
                }
                className={`inline-flex items-center justify-center gap-1 w-[140px] h-7 text-[11px] rounded-md font-medium transition-colors ${
                  smartSort
                    ? "bg-primary/15 text-primary border border-primary/20"
                    : "text-[#b8c5d6] border border-[#1f2937] hover:text-white hover:border-[#b8c5d6]/30"
                }`}
                data-testid="btn-inboria-smart-sort"
              >
                <Sparkles className="w-3 h-3" />
                <span>{t("inboriaSort.smartLabel", "Tri Inboria")}</span>
              </button>
              <button
                onClick={() => {
                  setSortMode((m) => (m === "priority" ? "date_desc" : m === "date_desc" ? "date_asc" : "priority"));
                }}
                disabled={smartSort}
                title={
                  smartSort
                    ? t("inboriaSort.disabledByInboria", "Désactivé tant que le tri Inboria est actif.")
                    : sortMode === "priority"
                    ? t("inbox.sortByPriority", "Tri : Priorité")
                    : sortMode === "date_desc"
                      ? t("inbox.sortByDateDesc", "Tri : Date ↓ (récent)")
                      : t("inbox.sortByDateAsc", "Tri : Date ↑ (ancien)")
                }
                className={`inline-flex items-center justify-center gap-1 w-[140px] h-7 text-[11px] rounded-md font-medium transition-colors ${
                  smartSort
                    ? "text-[#5a6478] border border-[#1f2937] opacity-50 cursor-not-allowed"
                    : sortMode !== "priority"
                    ? "bg-primary/15 text-primary border border-primary/20"
                    : "text-[#b8c5d6] border border-[#1f2937] hover:text-white hover:border-[#b8c5d6]/30"
                }`}
              >
                {sortMode === "priority" ? (
                  <ArrowUpDown className="w-3 h-3" />
                ) : sortMode === "date_desc" ? (
                  <ArrowDown className="w-3 h-3" />
                ) : (
                  <ArrowUp className="w-3 h-3" />
                )}
                <span>
                  {t("inbox.sortLabel", "Tri")}:{" "}
                  {sortMode === "priority"
                    ? t("inbox.sortPriority", "Priorité")
                    : t("inbox.sortDate", "Date")}
                </span>
              </button>
            </div>

          {(hasHubspot || hasPipedrive || hasSalesforce || hasOdoo) && (
            <div
              className="flex flex-wrap items-center gap-1.5 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 mt-2"
              data-testid="row-crm-filter"
            >
              {hasHubspot && (
                <button
                  onClick={() => setCrmFilter((c) => (c === "hubspot" ? null : "hubspot"))}
                  title={t("inbox.crmHubspotTooltip")}
                  data-testid="button-crm-hubspot"
                  className={`inline-flex items-center justify-center gap-1 w-[140px] h-7 text-[11px] rounded-md font-medium transition-colors ${
                    crmFilter === "hubspot"
                      ? "bg-primary/15 text-primary border border-primary/20"
                      : "text-[#b8c5d6] border border-[#1f2937] hover:text-white hover:border-[#b8c5d6]/30"
                  }`}
                >
                  <Building2 className="w-3 h-3" />
                  <span>HubSpot</span>
                </button>
              )}
              {hasPipedrive && (
                <button
                  onClick={() => setCrmFilter((c) => (c === "pipedrive" ? null : "pipedrive"))}
                  title={t("inbox.crmPipedriveTooltip")}
                  data-testid="button-crm-pipedrive"
                  className={`inline-flex items-center justify-center gap-1 w-[140px] h-7 text-[11px] rounded-md font-medium transition-colors ${
                    crmFilter === "pipedrive"
                      ? "bg-primary/15 text-primary border border-primary/20"
                      : "text-[#b8c5d6] border border-[#1f2937] hover:text-white hover:border-[#b8c5d6]/30"
                  }`}
                >
                  <Briefcase className="w-3 h-3" />
                  <span>Pipedrive</span>
                </button>
              )}
              {hasSalesforce && (
                <button
                  onClick={() => setCrmFilter((c) => (c === "salesforce" ? null : "salesforce"))}
                  title={t("inbox.crmSalesforceTooltip")}
                  data-testid="button-crm-salesforce"
                  className={`inline-flex items-center justify-center gap-1 w-[140px] h-7 text-[11px] rounded-md font-medium transition-colors ${
                    crmFilter === "salesforce"
                      ? "bg-primary/15 text-primary border border-primary/20"
                      : "text-[#b8c5d6] border border-[#1f2937] hover:text-white hover:border-[#b8c5d6]/30"
                  }`}
                >
                  <Cloud className="w-3 h-3" />
                  <span>Salesforce</span>
                </button>
              )}
              {hasOdoo && (
                <button
                  onClick={() => setCrmFilter((c) => (c === "odoo" ? null : "odoo"))}
                  title={t("inbox.crmOdooTooltip")}
                  data-testid="button-crm-odoo"
                  className={`inline-flex items-center justify-center gap-1 w-[140px] h-7 text-[11px] rounded-md font-medium transition-colors ${
                    crmFilter === "odoo"
                      ? "bg-primary/15 text-primary border border-primary/20"
                      : "text-[#b8c5d6] border border-[#1f2937] hover:text-white hover:border-[#b8c5d6]/30"
                  }`}
                >
                  <Database className="w-3 h-3" />
                  <span>Odoo</span>
                </button>
              )}
            </div>
          )}

        </div>
        )}

        <div className="flex-1 overflow-auto">
          <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5 flex flex-col md:flex-row gap-5">
            <div className="flex-1 min-w-0">
              {inboxMode === "shared" ? (
                <>
                  {sharedEmailsLoading ? (
                    <div className="flex flex-col items-center justify-center py-16 rounded-lg border border-border border-dashed bg-card/50">
                      <Loader2 className="w-6 h-6 text-primary animate-spin mb-3" />
                      <h3 className="text-[13px] font-medium text-white">{t("inbox.loadingTitle", "Chargement de vos emails…")}</h3>
                    </div>
                  ) : !selectedSharedMailboxId ? (
                    <div className="text-center py-14 rounded-lg border border-border border-dashed bg-card/50">
                      <Users className="mx-auto h-8 w-8 text-[#b8c5d6]/40 mb-2" />
                      <h3 className="text-[13px] font-medium text-white">{t("inbox.sharedMailbox")}</h3>
                    </div>
                  ) : sharedEmailsList.length === 0 ? (
                    <div className="text-center py-14 rounded-lg border border-border border-dashed bg-card/50">
                      <Inbox className="mx-auto h-8 w-8 text-[#b8c5d6]/40 mb-2" />
                      <h3 className="text-[13px] font-medium text-white">{t("inbox.noEmails")}</h3>
                      <p className="text-[12px] text-[#b8c5d6] mt-1">{t("inbox.noEmailsDesc")}</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {sharedEmailsList.map((email) => {
                        const isClaimed = !!email.claimedBy;
                        const isClaimedByMe = email.claimedBy === (profile as any)?.id;
                        const isSlaBreach = slaBreachIds.has(Number(email.id));
                        return (
                          <div
                            key={email.id}
                            className={`group flex items-stretch rounded-lg border bg-card hover:bg-[#1a2235] transition-colors overflow-hidden ${isSlaBreach ? "border-red-500/40" : "border-border"}`}
                          >
                            <div className={`w-0 shrink-0 hidden ${PRIORITY_BAR_COLORS[(email.priority || "faible") as keyof typeof PRIORITY_BAR_COLORS] || PRIORITY_BAR_COLORS.faible}`} />
                            <div className="flex items-start gap-3 flex-1 min-w-0 p-3">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-primary/20">
                                <span className="text-primary font-semibold text-[12px]">{(email.sender || "?")[0].toUpperCase()}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="font-semibold text-[12px] text-white truncate">{email.sender}</span>
                                  <PriorityBadge priority={(email.priority || "faible") as any} />
                                  {isSlaBreach && (
                                    <span
                                      className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold bg-red-500/15 text-red-400 border border-red-500/30 inline-flex items-center gap-1"
                                      title={t("inbox.slaOverdue", { defaultValue: "SLA overdue" })}
                                    >
                                      <AlertCircle className="w-2.5 h-2.5" />
                                      SLA
                                    </span>
                                  )}
                                  {((email as any).inboriaScore ?? 0) >= 3 && (
                                    <span
                                      className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold bg-primary/15 text-primary border border-primary/30 inline-flex items-center gap-1"
                                      title={
                                        ((email as any).inboriaReasons as string[] | undefined)?.length
                                          ? `${t("inboriaSort.strategicTooltip", "Inboria considère cet email comme stratégique :")}\n• ${((email as any).inboriaReasons as string[]).join("\n• ")}`
                                          : t("inboriaSort.strategic", "Stratégique")
                                      }
                                      data-testid={`badge-inboria-strategic-${email.id}`}
                                    >
                                      <Sparkles className="w-2.5 h-2.5" />
                                      {t("inboriaSort.strategic", "Stratégique")}
                                    </span>
                                  )}
                                  {isClaimed && (
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${isClaimedByMe ? "bg-primary/15 text-primary" : "bg-white/[0.06] text-[#b8c5d6]"}`}>
                                      {t("inbox.claimedBy")} {isClaimedByMe ? t("emails.me", { defaultValue: "moi" }) : ((email as any).claimedByName || t("sharedMailboxes.colleague"))}
                                    </span>
                                  )}
                                  {(email as any).assignedTo && (email as any).assignedTo === (email as any).claimedBy && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
                                      {t("sharedMailboxes.assignedBadge")}
                                    </span>
                                  )}
                                </div>
                                <h3 className="text-[12px] text-white/80 truncate">{email.subject}</h3>
                                {email.summary && (
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <Sparkles className="w-3 h-3 text-primary shrink-0" />
                                    <p className="text-[11px] text-[#b8c5d6] line-clamp-1">{email.summary}</p>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                {!isClaimed ? (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="gap-1 h-7 text-[10px] bg-transparent border-border text-primary hover:text-white hover:bg-primary/10"
                                      onClick={() => handleClaimEmail(email.id as any)}
                                      disabled={claimEmailMut.isPending}
                                    >
                                      <UserPlus className="w-3 h-3" />
                                      {t("inbox.claim")}
                                    </Button>
                                    {isOrgAdmin && (
                                      assigningInboxEmailId === email.id ? (
                                        <select
                                          autoFocus
                                          defaultValue=""
                                          onBlur={() => setAssigningInboxEmailId(null)}
                                          onChange={(e) => handleAssignInboxEmail(Number(email.id), e.target.value)}
                                          className="bg-card border border-border rounded-md text-[10px] h-7 px-2 text-white"
                                        >
                                          <option value="" disabled>{t("sharedMailboxes.selectColleague")}</option>
                                          {((orgMembers as any[]) || [])
                                            .filter((m: any) => m.userId && m.userId !== profile?.id)
                                            .map((m: any) => (
                                              <option key={m.userId} value={m.userId}>
                                                {m.fullName || m.email || m.userId}
                                              </option>
                                            ))}
                                        </select>
                                      ) : (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="gap-1 h-7 text-[10px] bg-transparent border-indigo-400/30 text-indigo-400 hover:text-white hover:bg-indigo-400/10"
                                          onClick={() => setAssigningInboxEmailId(email.id as any)}
                                          title={t("sharedMailboxes.assignToColleague")}
                                        >
                                          <UserPlus className="w-3 h-3" />
                                          {t("sharedMailboxes.assignToColleague")}
                                        </Button>
                                      )
                                    )}
                                  </>
                                ) : isClaimedByMe ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1 h-7 text-[10px] bg-transparent border-border text-[#b8c5d6] hover:text-white hover:bg-white/[0.04]"
                                    onClick={() => handleUnclaimEmail(email.id as any)}
                                    disabled={unclaimEmailMut.isPending}
                                  >
                                    <UserX className="w-3 h-3" />
                                    {t("inbox.unclaim")}
                                  </Button>
                                ) : null}
                                <span className="text-[10px] text-[#b8c5d6] ml-1">
                                  {email.createdAt ? format(new Date(email.createdAt), "dd MMM HH:mm", { locale: dateFnsLocale }) : ""}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {sharedHasMore && (
                        <div className="flex items-center justify-center py-4">
                          <button
                            onClick={loadMoreShared}
                            disabled={sharedFetching}
                            className="text-[11px] text-primary hover:text-white transition-colors px-3 py-1.5 rounded-md border border-primary/20 hover:border-primary/40 disabled:opacity-50"
                          >
                            {sharedFetching ? t("common.loading") : t("inbox.loadMore")}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Cartes de stats Urgents/Moyens/Faibles : visibles
                      uniquement en vue inbox normale. En vue "Assignes",
                      ces compteurs reflettent la priorite de TOUTE l'org
                      (source : /emails/summary), pas du filtre assignee
                      courant — les afficher serait trompeur. */}
                  {!assigneeFilter && (
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div
                      className={`rounded-lg border p-3 cursor-pointer transition-colors ${filterPriority === "urgent" ? "border-red-500/50 bg-red-500/15" : "border-red-500/20 bg-red-500/5 hover:bg-red-500/10"}`}
                      onClick={() => setFilterPriority(filterPriority === "urgent" ? "all" : "urgent")}
                    >
                      <div className="text-[10px] font-medium text-red-400 uppercase tracking-wider mb-0.5">{t("inbox.priorities.urgentPlural")}</div>
                      <div className="text-xl font-bold text-white">
                        {summaryLoading ? <span className="text-white/20">—</span> : summary?.urgentCount || 0}
                      </div>
                    </div>
                    <div
                      className={`rounded-lg border p-3 cursor-pointer transition-colors ${filterPriority === "moyen" ? "border-amber-500/50 bg-amber-500/15" : "border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10"}`}
                      onClick={() => setFilterPriority(filterPriority === "moyen" ? "all" : "moyen")}
                    >
                      <div className="text-[10px] font-medium text-amber-400 uppercase tracking-wider mb-0.5">{t("inbox.priorities.mediumPlural")}</div>
                      <div className="text-xl font-bold text-white">
                        {summaryLoading ? <span className="text-white/20">—</span> : summary?.moyenCount || 0}
                      </div>
                    </div>
                    <div
                      className={`rounded-lg border p-3 cursor-pointer transition-colors ${filterPriority === "faible" ? "border-emerald-500/50 bg-emerald-500/15" : "border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10"}`}
                      onClick={() => setFilterPriority(filterPriority === "faible" ? "all" : "faible")}
                    >
                      <div className="text-[10px] font-medium text-emerald-400 uppercase tracking-wider mb-0.5">{t("inbox.priorities.lowPlural")}</div>
                      <div className="text-xl font-bold text-white">
                        {summaryLoading ? <span className="text-white/20">—</span> : summary?.faibleCount || 0}
                      </div>
                    </div>
                  </div>
                  )}

                  {/* Banniere "Filtre sur <membre>" supprimee : redondante
                      avec l'en-tete dedie "Assignes a <membre>" affiche
                      tout en haut de la page quand assigneeFilter cible
                      un membre specifique. */}

                  <div data-selection-bar className={`flex items-center gap-2 mb-2 p-2.5 rounded-lg border h-[40px] ${selectionMode ? "bg-primary/[0.08] border-primary/20" : "bg-card/50 border-border"}`}>
                    <button
                      onClick={toggleSelectAll}
                      className="flex items-center gap-1.5 text-[11px] text-primary hover:text-white transition-colors"
                    >
                      {selectedIds.size === (activeEmails?.length || 0) && selectedIds.size > 0 ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                      {selectedIds.size === (activeEmails?.length || 0) && selectedIds.size > 0 ? t("inbox.deselectAll") : t("inbox.selectAll")}
                    </button>
                    {selectionMode && (
                      <>
                        <span className="text-[11px] text-[#b8c5d6]">
                          {t("inbox.selectedCount", { count: selectedIds.size })}
                        </span>
                        <div className="flex-1" />
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 h-7 text-[11px] bg-transparent border-border text-[#b8c5d6] hover:text-white hover:bg-white/[0.04]"
                          onClick={() => handleBulkAction("archive")}
                          disabled={bulkUpdateMut.isPending}
                        >
                          <Archive className="w-3 h-3" />
                          {t("inbox.bulkArchive")}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 h-7 text-[11px] bg-transparent border-border text-red-400/70 hover:text-red-400 hover:bg-red-500/[0.08]"
                          onClick={() => handleBulkAction("delete")}
                          disabled={bulkUpdateMut.isPending}
                        >
                          <Trash2 className="w-3 h-3" />
                          {t("inbox.deleteEmail")}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[#b8c5d6] hover:text-white"
                          onClick={() => setSelectedIds(new Set())}
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </div>

                  <div className="space-y-1">
                    {emailsLoading ? (
                      <div className="flex flex-col items-center justify-center py-16 rounded-lg border border-border border-dashed bg-card/50">
                        <Loader2 className="w-6 h-6 text-primary animate-spin mb-3" />
                        <h3 className="text-[13px] font-medium text-white">{t("inbox.loadingTitle", "Chargement de vos emails…")}</h3>
                        <p className="text-[12px] text-[#b8c5d6] mt-1">{t("inbox.loadingDesc", "Inboria récupère vos derniers messages, un instant.")}</p>
                      </div>
                    ) : activeEmails?.length === 0 ? (
                      <div className="text-center py-14 rounded-lg border border-border border-dashed bg-card/50">
                        {crmFilter === "hubspot" ? (
                          <>
                            <Building2 className="mx-auto h-8 w-8 text-primary/40 mb-2" />
                            <h3 className="text-[13px] font-medium text-white">{t("inbox.crmEmptyHubspotTitle")}</h3>
                            <p className="text-[12px] text-[#b8c5d6] mt-1">{t("inbox.crmEmptyHubspotDesc")}</p>
                          </>
                        ) : crmFilter === "pipedrive" ? (
                          <>
                            <Briefcase className="mx-auto h-8 w-8 text-primary/40 mb-2" />
                            <h3 className="text-[13px] font-medium text-white">{t("inbox.crmEmptyPipedriveTitle")}</h3>
                            <p className="text-[12px] text-[#b8c5d6] mt-1">{t("inbox.crmEmptyPipedriveDesc")}</p>
                          </>
                        ) : crmFilter === "salesforce" ? (
                          <>
                            <Cloud className="mx-auto h-8 w-8 text-primary/40 mb-2" />
                            <h3 className="text-[13px] font-medium text-white">{t("inbox.crmEmptySalesforceTitle")}</h3>
                            <p className="text-[12px] text-[#b8c5d6] mt-1">{t("inbox.crmEmptySalesforceDesc")}</p>
                          </>
                        ) : crmFilter === "odoo" ? (
                          <>
                            <Database className="mx-auto h-8 w-8 text-primary/40 mb-2" />
                            <h3 className="text-[13px] font-medium text-white">{t("inbox.crmEmptyOdooTitle")}</h3>
                            <p className="text-[12px] text-[#b8c5d6] mt-1">{t("inbox.crmEmptyOdooDesc")}</p>
                          </>
                        ) : (
                          <>
                            <Inbox className="mx-auto h-8 w-8 text-[#b8c5d6]/40 mb-2" />
                            <h3 className="text-[13px] font-medium text-white">{t("inbox.noEmails")}</h3>
                            <p className="text-[12px] text-[#b8c5d6] mt-1">{t("inbox.noEmailsDesc")}</p>
                          </>
                        )}
                      </div>
                    ) : (
                      <>
                        {(() => {
                          const isClassic = routeLocation.includes("inbox-classic");
                          const renderRow = (email: any) => {
                            const badge = resolveMailboxBadge(email, composeConnections, sharedMailboxes);
                            return (
                              <EmailRow
                                key={email.id}
                                email={email}
                                onClick={() => { if (didDragRef.current) return; if (selectionMode) { toggleSelect(email.id); } else { setSelectedEmailId(email.id); } }}
                                onArchive={handleArchive}
                                onDelete={handleDelete}
                                onCategoryClick={(name: string) => setFilterCategory(name)}
                                isSelected={selectedIds.has(email.id)}
                                onToggleSelect={toggleSelect}
                                selectionMode={selectionMode}
                                onContextMenu={handleContextMenu}
                                onDragSelectStart={handleDragSelectStart}
                                mailboxBadge={badge}
                                showMailboxBadge={selectedAccountId === "all" && (composeConnections?.length || 0) >= 2}
                                isSlaBreach={slaBreachIds.has(Number(email.id))}
                              />
                            );
                          };
                          if (isClassic) return (activeEmails || []).map(renderRow);
                          // Inboria-aware Important: priority urgent OR SLA
                          // breach OR awaiting reply OR explicit "important"
                          // boolean from server smart-sort score. Falls back
                          // to urgent+moyen when no Inboria signals present.
                          const isImportant = (e: any) => (
                            e.priority === "urgent" ||
                            slaBreachIds.has(Number(e.id)) ||
                            !!e.awaitingReply || !!e.awaiting_reply ||
                            !!e.isImportant || !!e.important ||
                            e.priority === "moyen"
                          );
                          const important = (activeEmails || []).filter(isImportant);
                          const other = (activeEmails || []).filter((e: any) => !isImportant(e));
                          return (
                            <>
                              {important.length > 0 && (
                                <div className="pt-1 pb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-[#8b95a7]">
                                  {t("inbox.sections.important")} <span className="text-[#8b95a7]/60 font-normal">({important.length})</span>
                                </div>
                              )}
                              {important.map(renderRow)}
                              {other.length > 0 && (
                                <div className="pt-3 pb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-[#8b95a7]">
                                  {t("inbox.sections.other")} <span className="text-[#8b95a7]/60 font-normal">({other.length})</span>
                                </div>
                              )}
                              {other.map(renderRow)}
                            </>
                          );
                        })()}
                        {hasMorePages && (
                          <div ref={loadMoreRef} className="py-2">
                            {emailsFetching ? (
                              <div className="flex items-center justify-center py-3">
                                <Loader2 className="w-4 h-4 text-primary/60 animate-spin" />
                              </div>
                            ) : (
                              <div className="flex items-center justify-center py-2">
                                <button
                                  onClick={loadMore}
                                  className="text-[11px] text-primary hover:text-white transition-colors px-3 py-1.5 rounded-md border border-primary/20 hover:border-primary/40"
                                >
                                  {t("inbox.loadMore")}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                        {!hasMorePages && emails.length > 50 && (
                          <div className="text-center py-3">
                            <span className="text-[10px] text-[#b8c5d6]/60">Tous les emails chargés ({totalEmails})</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

          </div>
        </div>
      </div>
      {!routeLocation.includes("inbox-classic") && (
        <>
          <div className="fixed bottom-0 left-[200px] right-0 z-30 pointer-events-none">
            <div className="mx-auto max-w-full px-4 pb-2">
              <div className="pointer-events-auto inline-flex items-center gap-3 rounded-md border border-[#1f2630] bg-[#0b0d10]/95 backdrop-blur px-3 py-1.5 text-[10px] text-[#8b95a7] shadow-lg">
                <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-[#161b22] border border-[#1f2630] text-[#e6e9ef] font-mono text-[10px]">J</kbd><kbd className="px-1.5 py-0.5 rounded bg-[#161b22] border border-[#1f2630] text-[#e6e9ef] font-mono text-[10px]">K</kbd> {t("inbox.shortcuts.navigate")}</span>
                <span className="w-px h-3 bg-[#1f2630]" />
                <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-[#161b22] border border-[#1f2630] text-[#e6e9ef] font-mono text-[10px]">E</kbd> {t("inbox.shortcuts.done")}</span>
                <span className="w-px h-3 bg-[#1f2630]" />
                <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-[#161b22] border border-[#1f2630] text-[#e6e9ef] font-mono text-[10px]">R</kbd> {t("inbox.shortcuts.reply")}</span>
                <span className="w-px h-3 bg-[#1f2630]" />
                <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-[#161b22] border border-[#1f2630] text-[#e6e9ef] font-mono text-[10px]">⌘K</kbd> {t("inbox.shortcuts.commands")}</span>
                <span className="w-px h-3 bg-[#1f2630]" />
                <Link href="/dashboard/inbox-classic" className="text-[#8b95a7] hover:text-[#e6e9ef] underline-offset-2 hover:underline">{t("inbox.classicInboxLink")}</Link>
              </div>
            </div>
          </div>
          <button
            type="button"
            title={t("inbox.help.tooltip")}
            onClick={() => toast({ title: t("inbox.help.comingSoonTitle"), description: t("inbox.help.comingSoonDesc") })}
            className="fixed bottom-4 right-4 z-40 w-9 h-9 rounded-full border border-[#1f2630] bg-[#11151b] text-[#8b95a7] hover:text-[#e6e9ef] hover:border-[#4F46E5]/40 transition-colors flex items-center justify-center text-[13px] font-semibold shadow-lg"
            aria-label={t("inbox.help.tooltip")}
          >
            ?
          </button>
          <button
            type="button"
            title={t("inbox.askInboria")}
            onClick={() => window.dispatchEvent(new CustomEvent("inboria-chat-open"))}
            className="fixed bottom-16 right-4 z-40 h-9 px-3 rounded-full border border-[#4F46E5]/40 bg-[#4F46E5]/10 text-[#e6e9ef] hover:bg-[#4F46E5]/20 transition-colors flex items-center gap-1.5 text-[12px] font-medium shadow-lg"
            aria-label={t("inbox.askInboria")}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#4F46E5]" />
            {t("inbox.askInboria")}
          </button>
        </>
      )}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          data-context-menu
          className="fixed z-[9999] min-w-[180px] rounded-lg border border-[#1f2937] bg-[#141c2b] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
          style={{ top: Math.min(contextMenu.y, window.innerHeight - 220), left: Math.min(contextMenu.x, window.innerWidth - 200) }}
          onMouseLeave={() => {
            if (contextMenuCloseTimer.current) clearTimeout(contextMenuCloseTimer.current);
            contextMenuCloseTimer.current = setTimeout(() => setContextMenu(null), 250);
          }}
          onMouseEnter={() => {
            if (contextMenuCloseTimer.current) {
              clearTimeout(contextMenuCloseTimer.current);
              contextMenuCloseTimer.current = null;
            }
          }}
        >
          {selectedIds.size > 1 && (
            <div className="px-3 py-2 border-b border-[#1f2937]">
              <span className="text-[10px] text-[#b8c5d6] uppercase tracking-wider font-medium">
                {t("inbox.selectedCount", { count: selectedIds.size })}
              </span>
            </div>
          )}
          <div className="py-1">
            {selectedIds.size <= 1 ? (
              <>
                <button
                  onClick={() => { setSelectedEmailId(contextMenu.emailId); setContextMenu(null); setSelectedIds(new Set()); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                  {t("inbox.openEmail")}
                </button>
                <button
                  onClick={() => { handleArchive(contextMenu.emailId); setContextMenu(null); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors"
                >
                  <Archive className="w-3.5 h-3.5" />
                  {t("inbox.archive")}
                </button>
                <button
                  onClick={() => { handleBlockSender(contextMenu.emailId); setContextMenu(null); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  {t("junk.blockSender")}
                </button>
                <div className="border-t border-[#1f2937] my-1" />
                <button
                  onClick={() => { handleDelete(contextMenu.emailId); setContextMenu(null); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-red-400/80 hover:bg-red-500/[0.08] hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {t("inbox.deleteEmail")}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => { handleBulkAction("archive"); setContextMenu(null); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#b8c5d6] hover:bg-white/[0.06] hover:text-white transition-colors"
                >
                  <Archive className="w-3.5 h-3.5" />
                  {t("inbox.bulkArchive")} ({selectedIds.size})
                </button>
                <div className="border-t border-[#1f2937] my-1" />
                <button
                  onClick={() => { handleBulkAction("delete"); setContextMenu(null); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-red-400/80 hover:bg-red-500/[0.08] hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {t("inbox.deleteEmail")} ({selectedIds.size})
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
