import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { extractEmailAddress } from "@/lib/utils";
import { EmailBodyRenderer } from "@/components/EmailBodyRenderer";
import { EmailComments } from "@/components/email-comments";
import { TaskAssigneePicker } from "@/components/task-assignee-picker";
import { AttachmentList, AttachmentBadge } from "@/components/AttachmentList";
import { FileAttachInput, type UploadedFile } from "@/components/FileAttachInput";
import { TemplateSuggestionBar } from "@/components/templates/template-suggestion-bar";
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
} from "@workspace/api-client-react";
import type { Email, PaginatedEmails, PaginatedSharedMailboxEmails, ListEmailsCrmFilter } from "@workspace/api-client-react";
import { getGetProfileQueryKey } from "@workspace/api-client-react";
import { useTranslation } from 'react-i18next';
import { translateCategoryName } from "@/lib/category-translations";
import { format } from "date-fns";
import { fr, enUS, nl } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Clock, CheckCircle2, Sparkles, Inbox, ArrowLeft, Reply, Forward, Archive, X, ChevronRight, Trash2, RefreshCw, Search, PenSquare, Send, Wand2, Loader2, Zap, CheckCircle, Tags, Check, CheckSquare, Square, UserPlus, UserX, Users, Hand, HandMetal, ListTodo, CalendarDays, Download, ShieldAlert, ArrowUpDown, ArrowDown, ArrowUp, Maximize2, Minimize2, AlertCircle, Building2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "wouter";
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
import { convert as htmlToPlainText } from "html-to-text";

const PRIORITY_BAR_COLORS: Record<string, string> = {
  urgent: "bg-red-500",
  moyen: "bg-amber-500",
  faible: "bg-emerald-500",
};

const PRIORITY_BADGE_STYLES: Record<string, { bg: string; text: string; border: string; labelKey: string }> = {
  urgent: { bg: "bg-red-500/15", text: "text-red-400", border: "border-red-500/20", labelKey: "inbox.priorities.urgent" },
  moyen: { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/20", labelKey: "inbox.priorities.medium" },
  faible: { bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/20", labelKey: "inbox.priorities.low" },
};

function PriorityBadge({ priority }: { priority: string }) {
  const { t } = useTranslation();
  const ps = PRIORITY_BADGE_STYLES[priority] || PRIORITY_BADGE_STYLES.faible;
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${ps.bg} ${ps.text} ${ps.border}`}>
      {t(ps.labelKey)}
    </span>
  );
}

function EmailRow({ email, onClick, onArchive, onDelete, onCategoryClick, isSelected, onToggleSelect, selectionMode, onContextMenu, onDragSelectStart, mailboxBadge, showMailboxBadge, isSlaBreach }: { email: any; onClick: () => void; onArchive: (id: number) => void; onDelete: (id: number) => void; onCategoryClick?: (name: string) => void; isSelected: boolean; onToggleSelect: (id: number) => void; selectionMode: boolean; onContextMenu?: (e: React.MouseEvent, emailId: number) => void; onDragSelectStart?: (id: number) => void; mailboxBadge?: MailboxBadge | null; showMailboxBadge?: boolean; isSlaBreach?: boolean }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? i18n.language.split("-")[0];
  const dateFnsLocale = i18n.language === "nl" ? nl : i18n.language === "en" ? enUS : fr;
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
      <div className={`w-1 shrink-0 ${barColor}`} />
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
              <p className="text-[11px] text-[#8b9cb3] line-clamp-1">{email.summary}</p>
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
          <span className="text-[10px] text-[#8b9cb3] whitespace-nowrap items-center gap-1 hidden sm:flex">
            <Clock className="w-3 h-3" />
            {format(new Date(email.createdAt), "d MMM HH:mm", { locale: dateFnsLocale })}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onArchive(email.id); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-white/[0.08] text-[#8b9cb3] hover:text-white"
            title={t("inbox.archive")}
          >
            <Archive className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(email.id); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-red-500/[0.08] text-[#8b9cb3] hover:text-red-400"
            title={t("inbox.deleteEmail")}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-[#8b9cb3]/40 group-hover:text-[#8b9cb3] transition-colors" />
        </div>
      </div>
    </div>
  );
}

function htmlBodyToPlainText(raw: string): string {
  if (!raw) return "";
  const looksLikeHtml = /<\/?[a-z][\s\S]*?>/i.test(raw);
  if (!looksLikeHtml) return raw;
  try {
    const text = htmlToPlainText(raw, {
      wordwrap: false,
      selectors: [
        { selector: "img", format: "skip" },
        { selector: "style", format: "skip" },
        { selector: "script", format: "skip" },
        { selector: "head", format: "skip" },
        { selector: "a", options: { ignoreHref: false, hideLinkHrefIfSameAsText: true } },
        { selector: "hr", format: "skip" },
      ],
    });
    return text.replace(/\n{3,}/g, "\n\n").trim();
  } catch {
    return raw.replace(/<[^>]+>/g, "").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
  }
}

function buildForwardCitation(email: any, t: (k: string) => string, dateLocale: any): string {
  const header = t("inbox.forwardCitationHeader");
  const fromLabel = t("inbox.forwardFromLabel");
  const dateLabel = t("inbox.forwardDateLabel");
  const subjectLabel = t("inbox.forwardSubjectLabel");
  const toLabel = t("inbox.forwardToLabel");
  let dateStr = "";
  try {
    const rawDate = email?.createdAt || email?.created_at || email?.received_at;
    if (rawDate) dateStr = format(new Date(rawDate), "Pp", { locale: dateLocale });
  } catch { dateStr = ""; }
  const plainBody = htmlBodyToPlainText(email?.body || "");
  const lines = [
    "",
    header,
    `${fromLabel} : ${email?.sender || ""}`,
    `${dateLabel} : ${dateStr}`,
    `${subjectLabel} : ${email?.subject || ""}`,
    `${toLabel} : ${email?.recipient || ""}`,
    "",
    plainBody.split("\n").map((l: string) => `> ${l}`).join("\n"),
  ];
  return lines.join("\n");
}

function EmailDetail({ email, onBack, onMarkRead, onArchive, onDelete, onUpdatePriority, onUpdateCategory, onUpdateProject, onSendReply, isSending, onGenerateDraft, isDrafting, categories, projects, currentUserId, orgMembers, onAssign, onUnassign, onCreateTask, connections, sharedMailboxes }: { email: any; onBack: () => void; onMarkRead: (id: number) => void; onArchive: (id: number) => void; onDelete: (id: number) => void; onUpdatePriority: (id: number, priority: string) => void; onUpdateCategory: (id: number, categoryId: string) => void; onUpdateProject: (id: number, projectId: string) => void; onSendReply: (to: string, subject: string, body: string, replyToEmailId?: number, attachments?: UploadedFile[], connectionId?: string, projectId?: string) => void; isSending: boolean; onGenerateDraft: (emailId: number, callback: (draft: string) => void) => void; isDrafting: boolean; categories: any[]; projects: any[]; currentUserId?: string; orgMembers?: any[]; onAssign?: (emailId: number, userId: string) => void; onUnassign?: (emailId: number) => void; onCreateTask?: (emailId: number, title: string, projectId?: string, assigneeUserIds?: string[]) => void; connections?: Array<{ id: string; provider: string; email_address: string; signature?: string | null }>; sharedMailboxes?: any[] }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? i18n.language.split("-")[0];
  const dateFnsLocale = i18n.language === "nl" ? nl : i18n.language === "en" ? enUS : fr;
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyAttachments, setReplyAttachments] = useState<UploadedFile[]>([]);
  const [replyTo, setReplyTo] = useState("");
  const [replySubject, setReplySubject] = useState("");
  const [replyText, setReplyText] = useState("");
  const [replyConnectionId, setReplyConnectionId] = useState<string>("");
  const [replyProjectId, setReplyProjectId] = useState<string>("");
  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwardAttachments, setForwardAttachments] = useState<UploadedFile[]>([]);
  const [forwardTo, setForwardTo] = useState("");
  const [forwardSubject, setForwardSubject] = useState("");
  const [forwardText, setForwardText] = useState("");
  const [forwardConnectionId, setForwardConnectionId] = useState<string>("");
  const [forwardIntroLoading, setForwardIntroLoading] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);

  const resolveDefaultConnectionId = useCallback(() => {
    if (!connections || connections.length === 0) return "";
    const recip = (email?.recipient || "").toLowerCase();
    const match = connections.find((c) => (c.email_address || "").toLowerCase() === recip);
    return String((match || connections[0]).id);
  }, [connections, email]);

  const signatureForConnection = useCallback((connId: string): string => {
    const conn = connections?.find((c) => String(c.id) === String(connId));
    return (conn?.signature || "").trim();
  }, [connections]);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskProjectId, setTaskProjectId] = useState("none");
  const [taskAssignees, setTaskAssignees] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const barColor = PRIORITY_BAR_COLORS[(email.priority || "faible") as keyof typeof PRIORITY_BAR_COLORS] || PRIORITY_BAR_COLORS.faible;

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-12 z-[5] flex items-center gap-2 mb-4 pb-2 pt-2 bg-[#0d1117]">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[11px] px-3 py-1.5 rounded-md font-medium transition-colors bg-primary/15 text-primary border border-primary/20"
        >
          <Inbox className="w-3.5 h-3.5" />
          {t("inbox.title")}
        </button>
        <div className="flex-1" />
        <PriorityBadge priority={(email.priority || "faible") as any} />
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="flex">
          <div className={`w-1 shrink-0 ${barColor}`} />
          <div className="flex-1 min-w-0">
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-[12px]">
                    {(email.sender || "?")[0].toUpperCase()}
                  </div>
                  <div>
                    {email.senderEmail ? (
                      <Link
                        href={`/dashboard/contacts/${encodeURIComponent(email.senderEmail)}`}
                        className="text-[13px] font-medium text-white hover:text-primary hover:underline transition-colors block"
                        data-testid="link-contact-sender"
                      >
                        {email.sender}
                      </Link>
                    ) : (
                      <div className="text-[13px] font-medium text-white">{email.sender}</div>
                    )}
                    {email.senderEmail && email.senderEmail !== email.sender && (
                      <Link
                        href={`/dashboard/contacts/${encodeURIComponent(email.senderEmail)}`}
                        className="text-[11px] text-[#8b9cb3] hover:text-primary hover:underline transition-colors block"
                      >
                        {email.senderEmail}
                      </Link>
                    )}
                  </div>
                </div>
                <span className="text-[10px] text-[#8b9cb3] flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {format(new Date(email.createdAt), "d MMMM yyyy a HH:mm", { locale: dateFnsLocale })}
                </span>
              </div>
              {(() => {
                const badge = resolveMailboxBadge(email, connections, sharedMailboxes);
                if (!badge) return null;
                return (
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-[10px] uppercase tracking-wider text-[#8b9cb3] font-medium">{t("inbox.receivedOn")}</span>
                    <span
                      title={badge.label}
                      aria-label={badge.label}
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border inline-flex items-center gap-1 ${badge.bgClass} ${badge.textClass} ${badge.borderClass}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${badge.dotClass}`} aria-hidden="true" />
                      <span className="truncate max-w-[260px]">{badge.label}</span>
                    </span>
                    {badge.isShared && (
                      <span className="text-[9px] px-1 py-0.5 rounded-full font-medium bg-zinc-700/60 text-zinc-200 border border-zinc-500/30">
                        {t("inbox.sharedShort")}
                      </span>
                    )}
                  </div>
                );
              })()}
              {(() => {
                const recipients = String(email.recipient || "")
                  .split(/\s*[,;]\s*/)
                  .map((p: string) => {
                    const m = p.match(/^\s*"?([^"<>]*?)"?\s*<\s*([^<>]+)\s*>\s*$/);
                    if (m) return { name: (m[1] || "").trim() || m[2].trim(), email: m[2].trim().toLowerCase() };
                    const bare = p.replace(/^["'<\s]+|["'>\s]+$/g, "").toLowerCase();
                    if (bare.includes("@")) return { name: bare, email: bare };
                    return null;
                  })
                  .filter((x): x is { name: string; email: string } => !!x);
                if (recipients.length === 0) return null;
                return (
                  <div className="flex items-start gap-1.5 mb-2 flex-wrap">
                    <span className="text-[10px] uppercase tracking-wider text-[#8b9cb3] font-medium mt-0.5">{t("inbox.toLabel", "À")}</span>
                    {recipients.map((r, i) => (
                      <span key={r.email} className="inline-flex items-center">
                        <Link
                          href={`/dashboard/contacts/${encodeURIComponent(r.email)}`}
                          className="text-[11px] text-[#8b9cb3] hover:text-primary hover:underline transition-colors"
                          data-testid={`link-contact-recipient-${r.email}`}
                        >
                          {r.name}
                        </Link>
                        {i < recipients.length - 1 && <span className="text-[11px] text-[#8b9cb3] mx-0.5">,</span>}
                      </span>
                    ))}
                  </div>
                );
              })()}
              <div className="text-[10px] uppercase tracking-wider text-[#8b9cb3] font-medium mb-1">{t("inbox.subjectLabel")}</div>
              <h2 className="text-[16px] font-bold text-white leading-snug">{email.subject || "(Sans objet)"}</h2>
              {(() => {
                const sn = (email as any).snoozedUntil;
                const oc = (email as any).openedCount as number | undefined;
                const oa = (email as any).openedAt as string | undefined;
                const sentAt = (email as any).sentAt;
                const snDate = sn ? new Date(sn) : null;
                // Wave 1 — badge persists while a snooze decision exists (past or future).
                // PATCH /emails/:id status=read clears snoozed_until, so any non-null value
                // means the user hasn't acknowledged the snooze yet.
                const showSnoozed = !!(snDate && !isNaN(snDate.getTime()));
                const showOpened = !!(sentAt && typeof oc === "number" && oc > 0);
                if (!showSnoozed && !showOpened) return null;
                return (
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {showSnoozed && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px]" data-testid="badge-snoozed-until">
                        <Clock className="w-2.5 h-2.5" />
                        {t("wave1.snoozedUntilLabel", { date: format(snDate!, "PPp", { locale: dateFnsLocale }) })}
                      </span>
                    )}
                    {showOpened && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px]" data-testid="badge-opened-count" title={oa ? t("wave1.openedAtLabel", { date: format(new Date(oa), "PPp", { locale: dateFnsLocale }) }) as string : undefined}>
                        <Eye className="w-2.5 h-2.5" />
                        {t("wave1.openedBadgeCount", { count: oc! })}
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>

            {email.summary && (
              <div className="px-4 py-2.5 bg-primary/[0.06] border-b border-border">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Sparkles className="w-3 h-3 text-primary" />
                  <span className="text-[10px] font-medium text-primary uppercase tracking-wider">{t("inbox.aiSummary")}</span>
                </div>
                <p className="text-[12px] text-[#8b9cb3] leading-relaxed">{email.summary}</p>
              </div>
            )}

            <div className="p-4">
              {email.body ? (
                <EmailBodyRenderer body={email.body} emailId={email.id} sender={email.senderEmail || email.sender} />
              ) : (
                <div className="space-y-2 animate-pulse" aria-label={t("inbox.loadingBody") as string}>
                  <div className="h-3 bg-white/5 rounded w-full" />
                  <div className="h-3 bg-white/5 rounded w-11/12" />
                  <div className="h-3 bg-white/5 rounded w-10/12" />
                  <div className="h-3 bg-white/5 rounded w-9/12" />
                  <div className="h-3 bg-white/5 rounded w-11/12" />
                </div>
              )}
              {email.attachments && email.attachments.length > 0 && (
                <AttachmentList attachments={email.attachments} />
              )}
            </div>

            <div className="px-4 py-3 border-t border-border">
              <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
                <Button
                  size="sm"
                  className="gap-1.5 h-7 text-[11px]"
                  onClick={() => {
                    if (!replyOpen) {
                      setReplyTo(extractEmailAddress(email.senderEmail) || extractEmailAddress(email.sender) || "");
                      setReplySubject(email.subject?.startsWith("Re:") ? email.subject : `Re: ${email.subject}`);
                      const defConn = resolveDefaultConnectionId();
                      setReplyConnectionId(defConn);
                      setReplyProjectId(email.project_id ? String(email.project_id) : "");
                      const sig = signatureForConnection(defConn);
                      setReplyText(sig ? `\n\n-- \n${sig}` : "");
                    }
                    setReplyOpen(!replyOpen);
                  }}
                >
                  <Reply className="w-3 h-3" />
                  {t("inbox.reply")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 h-7 text-[11px] bg-transparent border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
                  disabled={isDrafting}
                  onClick={() => {
                    setReplyTo(email.senderEmail || extractEmailAddress(email.sender) || "");
                    setReplySubject(email.subject?.startsWith("Re:") ? email.subject : `Re: ${email.subject}`);
                    const effectiveConnId = replyConnectionId || resolveDefaultConnectionId();
                    if (!replyConnectionId) setReplyConnectionId(effectiveConnId);
                    if (!replyProjectId && email.project_id) setReplyProjectId(String(email.project_id));
                    setReplyOpen(true);
                    onGenerateDraft(email.id, (draft) => {
                      setReplyText(draft || "");
                    });
                  }}
                >
                  {isDrafting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                  {isDrafting ? t("inbox.generating") : t("inbox.aiReply")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-7 text-[11px] bg-transparent border-border text-[#8b9cb3] hover:text-white hover:bg-white/[0.04]"
                  onClick={() => {
                    if (!forwardOpen) {
                      const defConn = resolveDefaultConnectionId();
                      setForwardConnectionId(defConn);
                      setForwardTo("");
                      const subj = email.subject || "";
                      const prefix = t("inbox.forwardSubjectPrefix");
                      setForwardSubject(subj.toLowerCase().startsWith(prefix.trim().toLowerCase()) ? subj : `${prefix}${subj}`);
                      const sig = signatureForConnection(defConn);
                      const sigBlock = sig ? `\n\n-- \n${sig}` : "";
                      const citation = buildForwardCitation(email, t, dateFnsLocale);
                      setForwardText(`${sigBlock}\n\n${citation}`);
                      setForwardAttachments([]);
                    }
                    setForwardOpen(!forwardOpen);
                  }}
                >
                  <Forward className="w-3 h-3" />
                  {t("inbox.forward")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-7 text-[11px] bg-transparent border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
                  disabled={forwardIntroLoading}
                  onClick={async () => {
                    const defConn = forwardConnectionId || resolveDefaultConnectionId();
                    if (!forwardConnectionId) setForwardConnectionId(defConn);
                    if (!forwardSubject) {
                      const subj = email.subject || "";
                      const prefix = t("inbox.forwardSubjectPrefix");
                      setForwardSubject(subj.toLowerCase().startsWith(prefix.trim().toLowerCase()) ? subj : `${prefix}${subj}`);
                    }
                    setForwardOpen(true);
                    setForwardIntroLoading(true);
                    try {
                      const { supabase } = await import("@/lib/supabase");
                      const { data: sessionData } = await supabase.auth.getSession();
                      const token = sessionData?.session?.access_token || "";
                      const baseUrl = import.meta.env.VITE_API_URL || `https://${window.location.host}`;
                      const resp = await fetch(`${baseUrl}/api/ai/forward-intro`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                        body: JSON.stringify({ emailId: email.id, to: forwardTo }),
                      });
                      const json = resp.ok ? await resp.json() : null;
                      const intro = (json?.intro || "").trim();
                      const sig = signatureForConnection(defConn);
                      const sigBlock = sig && !intro.includes(sig) ? `\n\n-- \n${sig}` : "";
                      const citation = buildForwardCitation(email, t, dateFnsLocale);
                      setForwardText(`${intro}${sigBlock}\n\n${citation}`);
                      if (resp.ok) {
                        queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
                      }
                    } catch {
                      // silent — keep panel open with whatever was there
                    } finally {
                      setForwardIntroLoading(false);
                    }
                  }}
                >
                  {forwardIntroLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                  {forwardIntroLoading ? t("inbox.generating") : t("inbox.aiForward")}
                </Button>
                <SnoozeButton
                  emailId={email.id}
                  snoozedUntil={(email as any).snoozedUntil ?? null}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-7 text-[11px] bg-transparent border-border text-[#8b9cb3] hover:text-white hover:bg-white/[0.04]"
                  onClick={() => onArchive(email.id)}
                >
                  <Archive className="w-3 h-3" />
                  {t("inbox.archive")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-7 text-[11px] bg-transparent border-border text-red-400/70 hover:text-red-400 hover:bg-red-500/[0.08]"
                  onClick={() => onDelete(email.id)}
                >
                  <Trash2 className="w-3 h-3" />
                  {t("inbox.deleteEmail")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-7 text-[11px] bg-transparent border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300"
                  onClick={() => {
                    if (!taskFormOpen) {
                      setTaskTitle(`${t("inbox.handlePrefix")} ${email.subject}`);
                      setTaskProjectId(email.projectId || "none");
                    }
                    setTaskFormOpen(!taskFormOpen);
                  }}
                >
                  <ListTodo className="w-3 h-3" />
                  {t("inbox.createTask")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-7 text-[11px] bg-transparent border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
                  onClick={async () => {
                    try {
                      const { supabase } = await import("@/lib/supabase");
                      const { data: sessionData } = await supabase.auth.getSession();
                      const token = sessionData?.session?.access_token || "";
                      const baseUrl = import.meta.env.VITE_API_URL || `https://${window.location.host}`;
                      const resp = await fetch(`${baseUrl}/api/ai/extract-appointment`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                        body: JSON.stringify({ emailId: email.id }),
                      });
                      const extracted = resp.ok ? await resp.json() : null;
                      if (resp.ok) {
                        queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
                      }
                      const params = new URLSearchParams();
                      params.set("title", extracted?.title || email.subject || "");
                      params.set("emailId", String(email.id));
                      params.set("participants", extracted?.participants || email.sender || "");
                      if (extracted?.location) params.set("location", extracted.location);
                      if (extracted?.description) params.set("description", extracted.description);
                      if (extracted?.startAt) params.set("startAt", extracted.startAt);
                      if (extracted?.endAt) params.set("endAt", extracted.endAt);
                      window.location.href = `/dashboard/agenda?create=1&${params.toString()}`;
                    } catch {
                      const params = new URLSearchParams();
                      params.set("title", email.subject || "");
                      params.set("emailId", String(email.id));
                      if (email.sender) params.set("participants", email.sender);
                      window.location.href = `/dashboard/agenda?create=1&${params.toString()}`;
                    }
                  }}
                >
                  <CalendarDays className="w-3 h-3" />
                  {t("agenda.createFromEmail")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-7 text-[11px] bg-transparent border-border text-[#8b9cb3] hover:text-white hover:bg-white/[0.04]"
                  onClick={async () => {
                    try {
                      const { downloadExport } = await import("@/lib/export-utils");
                      await downloadExport(`export/emails?id=${email.id}`, `email_${email.id}.csv`);
                      toast({ title: t("inbox.exportDownloaded") });
                    } catch {
                      toast({ title: t("inbox.exportError"), variant: "destructive" });
                    }
                  }}
                >
                  <Download className="w-3 h-3" />
                  {t("common.export")}
                </Button>
              </div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-[#8b9cb3] uppercase tracking-wider">{t("inbox.priority")}:</span>
                  <Select value={email.priority} onValueChange={(val) => onUpdatePriority(email.id, val)}>
                    <SelectTrigger className="w-[100px] h-6 bg-card border-border text-[11px] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="urgent">{t("inbox.priorities.urgent")}</SelectItem>
                      <SelectItem value="moyen">{t("inbox.priorities.medium")}</SelectItem>
                      <SelectItem value="faible">{t("inbox.priorities.low")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-[#8b9cb3] uppercase tracking-wider">{t("inbox.category")}:</span>
                  <Select value={email.categoryId?.toString() || "none"} onValueChange={(val) => onUpdateCategory(email.id, val)}>
                    <SelectTrigger className="w-[130px] h-6 bg-card border-border text-[11px] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="none">{t("inbox.uncategorized")}</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.categoryId} value={cat.categoryId.toString()}>{translateCategoryName(cat.categoryName, lang)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-[#8b9cb3] uppercase tracking-wider">{t("inbox.project")}:</span>
                  <Select value={email.projectId || "none"} onValueChange={(val) => onUpdateProject(email.id, val)}>
                    <SelectTrigger className="w-[140px] h-6 bg-card border-border text-[11px] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="none">{t("inbox.noProject")}</SelectItem>
                      {projects.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.reference} — {p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {orgMembers && orgMembers.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-[#8b9cb3] uppercase tracking-wider">{t("inbox.assignedTo")}:</span>
                    <Select
                      value={email.assignedTo || "none"}
                      onValueChange={(val) => {
                        if (val === "none") {
                          onUnassign?.(email.id);
                        } else {
                          onAssign?.(email.id, val);
                        }
                      }}
                    >
                      <SelectTrigger className="w-[150px] h-6 bg-card border-border text-[11px] text-white">
                        <SelectValue placeholder={t("inbox.notAssigned")} />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        <SelectItem value="none">{t("inbox.notAssigned")}</SelectItem>
                        {orgMembers.map((m: any) => (
                          <SelectItem key={m.userId} value={m.userId}>
                            {m.fullName || m.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>

            <EmailComments emailId={email.id} currentUserId={currentUserId} email={email} />

            {taskFormOpen && (
              <div className="px-4 pb-4 border-t border-border pt-3 space-y-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <ListTodo className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-[11px] font-medium text-cyan-400 uppercase tracking-wider">{t("inbox.newTask")}</span>
                </div>
                <div>
                  <label className="text-[10px] text-[#8b9cb3] uppercase tracking-wider mb-1 block">{t("inbox.taskTitle")}</label>
                  <Input
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder={t("inbox.taskTitlePlaceholder")}
                    className="bg-background border-border text-white text-[12px] h-8"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#8b9cb3] uppercase tracking-wider mb-1 block">{t("inbox.taskProjectOptional")}</label>
                  <Select value={taskProjectId} onValueChange={setTaskProjectId}>
                    <SelectTrigger className="w-full h-8 bg-background border-border text-[12px] text-white">
                      <SelectValue placeholder={t("inbox.noProject")} />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="none">{t("inbox.noProject")}</SelectItem>
                      {projects.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.reference} — {p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] text-[#8b9cb3] uppercase tracking-wider mb-1 block">{t("tasks.assignTo", "Assigner à")}</label>
                  <TaskAssigneePicker
                    members={(orgMembers as any[]) || []}
                    currentUserId={currentUserId || null}
                    value={taskAssignees}
                    onChange={setTaskAssignees}
                  />
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setTaskFormOpen(false); setTaskTitle(""); setTaskProjectId("none"); setTaskAssignees([]); }}
                    className="text-[#8b9cb3] hover:text-white h-7 text-[11px]"
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5 h-7 text-[11px]"
                    disabled={!taskTitle.trim()}
                    onClick={() => {
                      onCreateTask?.(
                        email.id,
                        taskTitle.trim(),
                        taskProjectId !== "none" ? taskProjectId : undefined,
                        taskAssignees,
                      );
                      setTaskFormOpen(false);
                      setTaskTitle("");
                      setTaskProjectId("none");
                      setTaskAssignees([]);
                    }}
                  >
                    <ListTodo className="w-3 h-3" />
                    {t("followup.create")}
                  </Button>
                </div>
              </div>
            )}


            {replyOpen && (
              <div className="px-4 pb-4 border-t border-border pt-3 space-y-2.5">
                <TemplateSuggestionBar
                  emailId={email.id}
                  enabled={replyOpen}
                  emailSender={email.sender || null}
                  emailSubject={email.subject || null}
                  onInsert={(body, subject) => {
                    setReplyText((prev) => (prev?.trim() ? `${body}\n\n${prev}` : body));
                    if (subject && !replySubject) setReplySubject(subject);
                  }}
                />
                {connections && connections.length > 1 && (
                  <div>
                    <label className="text-[10px] text-[#8b9cb3] uppercase tracking-wider mb-1 block">{t("inbox.from", "De")}</label>
                    <Select
                      value={replyConnectionId}
                      onValueChange={(v) => {
                        const oldSig = signatureForConnection(replyConnectionId);
                        const newSig = signatureForConnection(v);
                        setReplyConnectionId(v);
                        setReplyText((prev) => {
                          let base = prev || "";
                          if (oldSig) {
                            const oldBlock = `\n\n-- \n${oldSig}`;
                            const idx = base.lastIndexOf(oldBlock);
                            if (idx !== -1) base = base.slice(0, idx) + base.slice(idx + oldBlock.length);
                          }
                          if (newSig) base = `${base.replace(/\s+$/, "")}\n\n-- \n${newSig}`;
                          return base;
                        });
                      }}
                    >
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
                  <label className="text-[10px] text-[#8b9cb3] uppercase tracking-wider mb-1 block">{t("inbox.replyTo")}</label>
                  <Input
                    value={replyTo}
                    onChange={(e) => setReplyTo(e.target.value)}
                    placeholder="email@exemple.com"
                    className="bg-background border-border text-white text-[12px] h-8"
                  />
                </div>
                {projects && projects.length > 0 && (
                  <div>
                    <label className="text-[10px] text-[#8b9cb3] uppercase tracking-wider mb-1 block">{t("inbox.project")}</label>
                    <Select value={replyProjectId || "__none__"} onValueChange={(v) => setReplyProjectId(v === "__none__" ? "" : v)}>
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
                <div>
                  <label className="text-[10px] text-[#8b9cb3] uppercase tracking-wider mb-1 block">{t("inbox.subject")}</label>
                  <Input
                    value={replySubject}
                    onChange={(e) => setReplySubject(e.target.value)}
                    placeholder={t("inbox.subject")}
                    className="bg-background border-border text-white text-[12px] h-8"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#8b9cb3] uppercase tracking-wider mb-1 block">{t("inbox.message")}</label>
                  <Textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={t("inbox.replyPlaceholder")}
                    ref={(el) => {
                      if (el) {
                        el.style.height = "auto";
                        el.style.height = Math.max(480, el.scrollHeight) + "px";
                      }
                    }}
                    className="min-h-[480px] bg-background border-border text-white text-[14px] leading-relaxed resize-y overflow-hidden"
                  />
                </div>
                <div className="flex items-center gap-2 justify-between">
                  <FileAttachInput files={replyAttachments} onChange={setReplyAttachments} />
                  <div className="flex items-center gap-2">
                    <SaveAsTemplateButton subject={replySubject} body={replyText} sourceEmailId={email.id} />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setReplyOpen(false); setReplyText(""); setReplyTo(""); setReplySubject(""); setReplyAttachments([]); }}
                      className="text-[#8b9cb3] hover:text-white h-7 text-[11px]"
                    >
                      {t("common.cancel")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 h-7 text-[11px] bg-transparent border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
                      disabled={isSending || !replyTo.trim() || !replySubject.trim() || !replyText.trim()}
                      onClick={() => setScheduleDialogOpen(true)}
                      data-testid="button-schedule-send"
                    >
                      <CalendarDays className="w-3 h-3" />
                      {t("wave1.scheduleButton")}
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5 h-7 text-[11px]"
                      disabled={isSending || !replyTo.trim() || !replySubject.trim() || !replyText.trim()}
                      onClick={() => {
                        onSendReply(replyTo, replySubject, replyText, email.id, replyAttachments, replyConnectionId || undefined, replyProjectId || undefined);
                        setReplyText("");
                        setReplyTo("");
                        setReplySubject("");
                        setReplyAttachments([]);
                        setReplyConnectionId("");
                        setReplyProjectId("");
                        setReplyOpen(false);
                      }}
                    >
                      <Send className="w-3 h-3" />
                      {isSending ? t("inbox.sending") : t("inbox.send")}
                    </Button>
                  </div>
                </div>
                <ScheduleSendDialog
                  open={scheduleDialogOpen}
                  onOpenChange={setScheduleDialogOpen}
                  to={replyTo}
                  subject={replySubject}
                  body={replyText}
                  replyToEmailId={email.id}
                  connectionId={replyConnectionId || undefined}
                  projectId={replyProjectId || undefined}
                  attachments={replyAttachments}
                  onScheduled={() => {
                    setReplyText("");
                    setReplyTo("");
                    setReplySubject("");
                    setReplyAttachments([]);
                    setReplyConnectionId("");
                    setReplyProjectId("");
                    setReplyOpen(false);
                  }}
                />
              </div>
            )}

            {forwardOpen && (
              <div className="px-4 pb-4 border-t border-border pt-3 space-y-2.5">
                {connections && connections.length > 1 && (
                  <div>
                    <label className="text-[10px] text-[#8b9cb3] uppercase tracking-wider mb-1 block">{t("inbox.from", "De")}</label>
                    <Select
                      value={forwardConnectionId}
                      onValueChange={(v) => {
                        const oldSig = signatureForConnection(forwardConnectionId);
                        const newSig = signatureForConnection(v);
                        setForwardConnectionId(v);
                        setForwardText((prev) => {
                          let base = prev || "";
                          if (oldSig) {
                            const oldBlock = `\n\n-- \n${oldSig}`;
                            const idx = base.indexOf(oldBlock);
                            if (idx !== -1) base = base.slice(0, idx) + base.slice(idx + oldBlock.length);
                          }
                          if (newSig) {
                            const citation = buildForwardCitation(email, t, dateFnsLocale);
                            const citIdx = base.indexOf(citation.split("\n").find((l) => l.trim().length > 0) || "");
                            if (citIdx > 0) {
                              base = `${base.slice(0, citIdx).replace(/\s+$/, "")}\n\n-- \n${newSig}\n\n${base.slice(citIdx)}`;
                            } else {
                              base = `${base.replace(/\s+$/, "")}\n\n-- \n${newSig}`;
                            }
                          }
                          return base;
                        });
                      }}
                    >
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
                  <label className="text-[10px] text-[#8b9cb3] uppercase tracking-wider mb-1 block">{t("inbox.replyTo")}</label>
                  <Input
                    value={forwardTo}
                    onChange={(e) => setForwardTo(e.target.value)}
                    placeholder="email@exemple.com"
                    className="bg-background border-border text-white text-[12px] h-8"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#8b9cb3] uppercase tracking-wider mb-1 block">{t("inbox.subject")}</label>
                  <Input
                    value={forwardSubject}
                    onChange={(e) => setForwardSubject(e.target.value)}
                    placeholder={t("inbox.subject")}
                    className="bg-background border-border text-white text-[12px] h-8"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#8b9cb3] uppercase tracking-wider mb-1 block">{t("inbox.message")}</label>
                  <Textarea
                    value={forwardText}
                    onChange={(e) => setForwardText(e.target.value)}
                    placeholder={t("inbox.replyPlaceholder")}
                    ref={(el) => {
                      if (el) {
                        el.style.height = "auto";
                        el.style.height = Math.max(480, el.scrollHeight) + "px";
                      }
                    }}
                    className="min-h-[480px] bg-background border-border text-white text-[14px] leading-relaxed resize-y overflow-hidden"
                  />
                </div>
                {Array.isArray(email?.attachments) && email.attachments.length > 0 && (
                  <div className="text-[11px] text-[#8b9cb3] bg-white/[0.02] border border-border rounded-md p-2">
                    <div className="font-medium text-white/80 mb-1">{t("inbox.forwardOriginalAttachments")} ({email.attachments.length})</div>
                    <div className="text-[#8b9cb3]">{email.attachments.map((a: any) => a.filename || a.name || "").filter(Boolean).join(", ")}</div>
                    <div className="mt-1 text-[10px] text-[#8b9cb3]/80">{t("inbox.forwardReattachHint")}</div>
                  </div>
                )}
                <div className="flex items-center gap-2 justify-between">
                  <FileAttachInput files={forwardAttachments} onChange={setForwardAttachments} />
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setForwardOpen(false); setForwardText(""); setForwardTo(""); setForwardSubject(""); setForwardAttachments([]); }}
                      className="text-[#8b9cb3] hover:text-white h-7 text-[11px]"
                    >
                      {t("common.cancel")}
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5 h-7 text-[11px]"
                      disabled={isSending || !forwardTo.trim() || !forwardSubject.trim() || !forwardText.trim()}
                      onClick={() => {
                        onSendReply(forwardTo, forwardSubject, forwardText, undefined, forwardAttachments, forwardConnectionId || undefined, undefined);
                        setForwardText("");
                        setForwardTo("");
                        setForwardSubject("");
                        setForwardAttachments([]);
                        setForwardConnectionId("");
                        setForwardOpen(false);
                      }}
                    >
                      <Send className="w-3 h-3" />
                      {isSending ? t("inbox.sending") : t("inbox.send")}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-start mt-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[11px] px-3 py-1.5 rounded-md font-medium transition-colors bg-primary/15 text-primary border border-primary/20 hover:bg-primary/25"
        >
          <Inbox className="w-3.5 h-3.5" />
          {t("inbox.title")}
        </button>
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
          className="text-[#8b9cb3] hover:text-white p-1 rounded hover:bg-white/[0.04] mr-2"
          aria-label={isFullscreen ? t("inbox.exitFullscreen", "Quitter plein écran") : t("inbox.fullscreen", "Plein écran")}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </DialogHeader>
      <div className="space-y-3 p-5 overflow-y-auto flex-1">
        {connections.length > 1 && (
          <div>
            <label className="text-[11px] text-[#8b9cb3] mb-1 block">{t("inbox.from", "De")}</label>
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
          <label className="text-[11px] text-[#8b9cb3] mb-1 block">{t("inbox.to")}</label>
          <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="email@exemple.com" className="bg-background border-border text-white text-[12px] h-8" />
        </div>
        <div>
          <label className="text-[11px] text-[#8b9cb3] mb-1 block">{t("inbox.subject")}</label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t("inbox.subject")} className="bg-background border-border text-white text-[12px] h-8" />
        </div>
        {projects && projects.length > 0 && (
          <div>
            <label className="text-[11px] text-[#8b9cb3] mb-1 block">{t("inbox.project")}</label>
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
          <label className="text-[11px] text-[#8b9cb3] mb-1 block">{t("inbox.message")}</label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t("inbox.message")}
            className={
              isFullscreen
                ? "bg-background border-border text-white text-[13px] flex-1 min-h-[300px] resize-none"
                : "bg-background border-border text-white text-[13px] min-h-[260px] resize-y"
            }
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

// Wave HubSpot — petit panneau latéral affiché à droite de la Réception
// quand le filtre CRM HubSpot est actif. Lit /api/integrations/hubspot/stats.
function HubspotContextPanel({ onHide }: { onHide: () => void }) {
  const { t } = useTranslation();
  const { data: stats } = useQuery({
    queryKey: ["hubspot-stats"],
    queryFn: async () => {
      const { supabase } = await import("@/lib/supabase");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch(`${import.meta.env.BASE_URL}api/integrations/hubspot/stats`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("failed");
      return res.json() as Promise<{
        connected: boolean;
        contactsCount: number;
        dealsCount: number;
        lastSyncedAt: string | null;
        lastError: string | null;
      }>;
    },
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });
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
        <button
          onClick={onHide}
          title={t("inbox.crmHide")}
          className="text-[#8b9cb3] hover:text-white"
          data-testid="button-hubspot-hide"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      {stats && stats.contactsCount === 0 ? (
        <p className="text-[10px] text-[#8b9cb3] leading-relaxed">{t("inbox.crmNoContacts")}</p>
      ) : (
        <>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#8b9cb3]">{t("inbox.crmContacts")}</span>
            <span className="text-white font-medium">{stats?.contactsCount ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#8b9cb3]">{t("inbox.crmDeals")}</span>
            <span className="text-white font-medium">{stats?.dealsCount ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between text-[10px] pt-1 border-t border-[#1f2937]">
            <span className="text-[#8b9cb3]">{t("inbox.crmLastSync")}</span>
            <span className="text-[#8b9cb3]">
              {stats?.lastSyncedAt
                ? new Date(stats.lastSyncedAt).toLocaleDateString()
                : t("inbox.crmNeverSynced")}
            </span>
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

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? i18n.language.split("-")[0];
  const dateFnsLocale = i18n.language === "nl" ? nl : i18n.language === "en" ? enUS : fr;
  const [filterPriority, setFilterPriority] = useState<string>("all");
  // Wave HubSpot — filtre Réception sur les expéditeurs présents dans HubSpot.
  const [crmFilter, setCrmFilter] = useState<"hubspot" | null>(null);
  const integrationsQuery = useListIntegrations();
  const hasHubspot = !!(integrationsQuery.data as any[] | undefined)?.find(
    (i: any) => i.provider === "hubspot" && i.enabled,
  );
  // Désactive automatiquement le filtre si HubSpot est déconnecté.
  useEffect(() => {
    if (!hasHubspot && crmFilter === "hubspot") setCrmFilter(null);
  }, [hasHubspot, crmFilter]);
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
  const [selectedEmailId, setSelectedEmailId] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const id = params.get("emailId");
    const num = id ? Number(id) : NaN;
    return Number.isFinite(num) && num > 0 ? num : null;
  });
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
  const [accumulatedSharedEmails, setAccumulatedSharedEmails] = useState<PaginatedSharedMailboxEmails["emails"]>([]);
  const { data: sharedEmailsData, isLoading: sharedEmailsLoading, isFetching: sharedFetching } = useGetSharedMailboxEmails(
    selectedSharedMailboxId || "",
    { page: sharedPage, limit: 50 },
    { query: { enabled: !!selectedSharedMailboxId && inboxMode === "shared" } as any }
  );
  const sharedPaged = sharedEmailsData as PaginatedSharedMailboxEmails | undefined;
  const sharedHasMore = sharedPaged ? sharedPage < (sharedPaged.totalPages ?? 1) : false;

  useEffect(() => {
    if (sharedPaged) {
      if (sharedPage === 1) {
        setAccumulatedSharedEmails(sharedPaged.emails || []);
      } else {
        setAccumulatedSharedEmails((prev) => {
          const existingIds = new Set(prev.map((e) => e.id));
          const unique = (sharedPaged.emails || []).filter((e) => !existingIds.has(e.id));
          return [...prev, ...unique];
        });
      }
    }
  }, [sharedPaged, sharedPage]);

  useEffect(() => {
    setSharedPage(1);
    setAccumulatedSharedEmails([]);
  }, [selectedSharedMailboxId]);

  const loadMoreShared = useCallback(() => {
    if (sharedHasMore && !sharedFetching) {
      setSharedPage((p) => p + 1);
    }
  }, [sharedHasMore, sharedFetching]);

  const sharedEmailsList = accumulatedSharedEmails;
  const claimEmailMut = useClaimSharedEmail();
  const unclaimEmailMut = useUnclaimSharedEmail();

  const selectedCategoryId = filterCategory !== "all"
    ? categoryCounts?.find((c) => c.categoryName === filterCategory)?.categoryId
    : undefined;

  const [emailPage, setEmailPage] = useState(1);
  const [accumulatedEmails, setAccumulatedEmails] = useState<Email[]>([]);
  const [totalEmails, setTotalEmails] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const prevFilterKey = useRef("");
  const currentFilterKey = `${filterPriority}|${searchQuery}|${filterCategory}|${crmFilter || ""}`;
  useEffect(() => {
    if (prevFilterKey.current !== currentFilterKey) {
      prevFilterKey.current = currentFilterKey;
      setEmailPage(1);
      setAccumulatedEmails([]);
    }
  }, [currentFilterKey]);

  const { data: emailsData, isLoading: emailsLoading, isFetching: emailsFetching } = useListEmails({
    priority: filterPriority !== "all" ? (filterPriority as "urgent" | "moyen" | "faible") : undefined,
    categoryId: selectedCategoryId,
    q: searchQuery || undefined,
    page: emailPage,
    limit: 200,
    ...(crmFilter ? { crmFilter: crmFilter as ListEmailsCrmFilter } : {}),
  });

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

  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isComposeFullscreen, setIsComposeFullscreen] = useState(false);
  const [composePrefill, setComposePrefill] = useState<{ to: string; subject: string; body: string } | null>(null);


  const isMobileViewport = typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches;

  useEffect(() => {
    if (isComposeOpen && isMobileViewport) setIsComposeFullscreen(true);
  }, [isComposeOpen, isMobileViewport]);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("compose") !== "1") return;
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
      url.searchParams.delete("compose");
      window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
    } catch {
      /* noop */
    }
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
      if (!selectedAccountEmail) return true;
      const sharedId = e.shared_mailbox_id ?? e.sharedMailboxId ?? null;
      if (sharedId) return false;
      if (!e.recipient) return false;
      return recipientMatchesAddress(e.recipient, selectedAccountEmail);
    })
    .sort((a, b) => {
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

  const handleSendReply = (to: string, subject: string, body: string, replyToEmailId?: number, attachments?: UploadedFile[], connectionId?: string, projectId?: string) => {
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
        toast({ variant: "destructive", title: t("common.error"), description: data.error });
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

  const hasSharedMailboxes = plan === "business" && sharedMailboxes && (sharedMailboxes as any[]).length > 0;

  if (selectedEmail) {
    return (
      <DashboardLayout>
        <div className="p-5 max-w-[900px] mx-auto w-full">
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
      </DashboardLayout>
    );
  }

  const displayedEmailCount = activeEmails?.length || 0;

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full">
        <div className="px-5 pt-4 pb-2.5 border-b border-border">
          <div className="flex items-center gap-2 mb-2.5 max-w-[1200px] mx-auto">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8b9cb3]" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t("inbox.searchPlaceholder")}
                className="pl-9 bg-card border-border text-white placeholder:text-[#8b9cb3]/50 h-8 text-[12px]"
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8b9cb3] hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-8 text-[11px] bg-transparent border-border text-[#8b9cb3] hover:text-white hover:bg-white/[0.04]"
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

          <div className="flex flex-wrap items-center gap-1 gap-y-1.5 max-w-[1200px] mx-auto mb-1.5">
              <button
                onClick={() => { setInboxMode("personal"); setSelectedSharedMailboxId(null); }}
                className={`flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-md font-medium transition-colors ${
                  inboxMode === "personal"
                    ? "bg-primary/15 text-primary border border-primary/20"
                    : "text-[#8b9cb3] border border-[#1f2937] hover:text-white hover:border-[#8b9cb3]/30"
                }`}
              >
                <Inbox className="w-3 h-3" />
                {t("inbox.title")}
              </button>
              {hasSharedMailboxes && (
                <button
                  onClick={() => {
                    setInboxMode("shared");
                    const mbs = sharedMailboxes as any[];
                    if (mbs?.length > 0 && !selectedSharedMailboxId) {
                      setSelectedSharedMailboxId(mbs[0].id);
                    }
                  }}
                  className={`flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-md font-medium transition-colors ${
                    inboxMode === "shared"
                      ? "bg-primary/15 text-primary border border-primary/20"
                      : "text-[#8b9cb3] border border-[#1f2937] hover:text-white hover:border-[#8b9cb3]/30"
                  }`}
                >
                  <Users className="w-3 h-3" />
                  {t("inbox.sharedMailbox")}
                </button>
              )}
              <Link
                href="/dashboard/indesirables"
                className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-md font-medium transition-colors text-[#8b9cb3] border border-[#1f2937] hover:text-white hover:border-[#8b9cb3]/30"
              >
                <ShieldAlert className="w-3 h-3" />
                {t("inbox.spam")}
                {spamCountFromApi > 0 && (
                  <span className="text-[9px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full">{spamCountFromApi}</span>
                )}
              </Link>
              <Link
                href="/dashboard/corbeille"
                className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-md font-medium transition-colors text-[#8b9cb3] border border-[#1f2937] hover:text-white hover:border-[#8b9cb3]/30"
              >
                <Trash2 className="w-3 h-3" />
                {t("inbox.trash")}
                {trashCountFromApi > 0 && (
                  <span className="text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full">{trashCountFromApi}</span>
                )}
              </Link>
              {inboxMode === "personal" && (composeConnections?.length || 0) >= 2 && (
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                  <SelectTrigger className="w-auto min-w-[140px] h-6 bg-card border-border text-[#8b9cb3] text-[10px] ml-1">
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
                          className="inline-flex items-center gap-1 ml-1 px-2 py-0.5 rounded-md border border-red-500/30 bg-red-500/10 text-red-400 text-[10px] font-medium hover:bg-red-500/20 transition-colors"
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
                        <ul className="text-[10px] text-[#8b9cb3] space-y-0.5">
                          {downConns.map((c) => (
                            <li key={c.id}>• {c.email_address}</li>
                          ))}
                        </ul>
                        <p className="text-[10px] mt-1.5 text-[#8b9cb3]">
                          {t("inbox.disconnectedTooltipCta", { defaultValue: "Cliquez pour reconnecter dans Paramètres." })}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })()}
              {inboxMode === "shared" && (sharedMailboxes as any[])?.length > 1 && (
                <Select value={selectedSharedMailboxId || ""} onValueChange={setSelectedSharedMailboxId}>
                  <SelectTrigger className="w-auto min-w-[120px] h-6 bg-card border-border text-[#8b9cb3] text-[10px] ml-1">
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

          <div className="flex flex-wrap items-center gap-1.5 gap-y-2 max-w-[1200px] mx-auto">
              <span className="text-[10px] text-[#8b9cb3] mr-1">{t("inbox.priority")}:</span>
              {[
                { value: "all", label: t("inbox.allCategories") },
                { value: "urgent", label: t("inbox.priorities.urgent") },
                { value: "moyen", label: t("inbox.priorities.medium") },
                { value: "faible", label: t("inbox.priorities.low") },
              ].map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilterPriority(f.value)}
                  className={`text-[10px] px-2 py-0.5 rounded-md font-medium transition-colors ${
                    filterPriority === f.value
                      ? "bg-primary/15 text-primary border border-primary/20"
                      : "text-[#8b9cb3] border border-[#1f2937] hover:text-white hover:border-[#8b9cb3]/30"
                  }`}
                >
                  {f.label}
                </button>
              ))}
              <div className="w-px h-4 bg-[#1f2937] mx-1" />
              <button
                onClick={() => {
                  setSortMode((m) => (m === "priority" ? "date_desc" : m === "date_desc" ? "date_asc" : "priority"));
                }}
                title={
                  sortMode === "priority"
                    ? t("inbox.sortByPriority", "Tri : Priorité")
                    : sortMode === "date_desc"
                      ? t("inbox.sortByDateDesc", "Tri : Date ↓ (récent)")
                      : t("inbox.sortByDateAsc", "Tri : Date ↑ (ancien)")
                }
                className={`text-[10px] px-2 py-0.5 rounded-md font-medium transition-colors flex items-center gap-1 ${
                  sortMode !== "priority"
                    ? "bg-primary/15 text-primary border border-primary/20"
                    : "text-[#8b9cb3] border border-[#1f2937] hover:text-white hover:border-[#8b9cb3]/30"
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
              <div className="basis-full h-0 sm:hidden" />
              <div className="hidden sm:block w-px h-4 bg-[#1f2937] mx-1" />
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-auto min-w-[130px] h-6 bg-card border-border text-[#8b9cb3] text-[10px]">
                  <SelectValue placeholder={t("inbox.category")} />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="all">{t("inbox.allCategories")}</SelectItem>
                  {categoryCounts?.map((cat) => (
                    <SelectItem key={cat.categoryId} value={cat.categoryName}>{translateCategoryName(cat.categoryName, lang)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

          {hasHubspot && (
            <div
              className="flex flex-wrap items-center gap-1.5 max-w-[1200px] mx-auto mt-2"
              data-testid="row-crm-filter"
            >
              <span className="text-[10px] text-[#8b9cb3] mr-1">{t("inbox.crmLabel")}:</span>
              <button
                onClick={() => setCrmFilter((c) => (c === "hubspot" ? null : "hubspot"))}
                title={t("inbox.crmHubspotTooltip")}
                data-testid="button-crm-hubspot"
                className={`text-[10px] px-2 py-0.5 rounded-md font-medium transition-colors flex items-center gap-1 ${
                  crmFilter === "hubspot"
                    ? "bg-primary/15 text-primary border border-primary/20"
                    : "text-[#8b9cb3] border border-[#1f2937] hover:text-white hover:border-[#8b9cb3]/30"
                }`}
              >
                <Building2 className="w-3 h-3" />
                <span>HubSpot</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto">
          <div className="p-5 max-w-[1200px] mx-auto flex flex-col lg:flex-row gap-5">
            <div className="flex-1 min-w-0">
              {inboxMode === "shared" ? (
                <>
                  {sharedEmailsLoading ? (
                    Array(3).fill(0).map((_, i) => (
                      <div key={i} className="bg-card rounded-lg border border-border p-3 mb-1">
                        <Skeleton className="h-4 w-3/4 mb-2 bg-white/5" />
                        <Skeleton className="h-3 w-1/2 bg-white/5" />
                      </div>
                    ))
                  ) : !selectedSharedMailboxId ? (
                    <div className="text-center py-14 rounded-lg border border-border border-dashed bg-card/50">
                      <Users className="mx-auto h-8 w-8 text-[#8b9cb3]/40 mb-2" />
                      <h3 className="text-[13px] font-medium text-white">{t("inbox.sharedMailbox")}</h3>
                    </div>
                  ) : sharedEmailsList.length === 0 ? (
                    <div className="text-center py-14 rounded-lg border border-border border-dashed bg-card/50">
                      <Inbox className="mx-auto h-8 w-8 text-[#8b9cb3]/40 mb-2" />
                      <h3 className="text-[13px] font-medium text-white">{t("inbox.noEmails")}</h3>
                      <p className="text-[12px] text-[#8b9cb3] mt-1">{t("inbox.noEmailsDesc")}</p>
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
                            <div className={`w-1 shrink-0 ${PRIORITY_BAR_COLORS[(email.priority || "faible") as keyof typeof PRIORITY_BAR_COLORS] || PRIORITY_BAR_COLORS.faible}`} />
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
                                  {isClaimed && (
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${isClaimedByMe ? "bg-primary/15 text-primary" : "bg-white/[0.06] text-[#8b9cb3]"}`}>
                                      {isClaimedByMe ? t("inbox.claimedBy") : t("inbox.claim")}
                                    </span>
                                  )}
                                </div>
                                <h3 className="text-[12px] text-white/80 truncate">{email.subject}</h3>
                                {email.summary && (
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <Sparkles className="w-3 h-3 text-primary shrink-0" />
                                    <p className="text-[11px] text-[#8b9cb3] line-clamp-1">{email.summary}</p>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {!isClaimed ? (
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
                                ) : isClaimedByMe ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1 h-7 text-[10px] bg-transparent border-border text-[#8b9cb3] hover:text-white hover:bg-white/[0.04]"
                                    onClick={() => handleUnclaimEmail(email.id as any)}
                                    disabled={unclaimEmailMut.isPending}
                                  >
                                    <UserX className="w-3 h-3" />
                                    {t("inbox.unclaim")}
                                  </Button>
                                ) : null}
                                <span className="text-[10px] text-[#8b9cb3] ml-1">
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
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div
                      className={`rounded-lg border p-3 cursor-pointer transition-colors ${filterPriority === "urgent" ? "border-red-500/50 bg-red-500/15" : "border-red-500/20 bg-red-500/5 hover:bg-red-500/10"}`}
                      onClick={() => setFilterPriority(filterPriority === "urgent" ? "all" : "urgent")}
                    >
                      <div className="text-[10px] font-medium text-red-400 uppercase tracking-wider mb-0.5">{t("inbox.priorities.urgentPlural")}</div>
                      <div className="text-xl font-bold text-white">
                        {summaryLoading ? <Skeleton className="h-6 w-8 bg-white/5" /> : summary?.urgentCount || 0}
                      </div>
                    </div>
                    <div
                      className={`rounded-lg border p-3 cursor-pointer transition-colors ${filterPriority === "moyen" ? "border-amber-500/50 bg-amber-500/15" : "border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10"}`}
                      onClick={() => setFilterPriority(filterPriority === "moyen" ? "all" : "moyen")}
                    >
                      <div className="text-[10px] font-medium text-amber-400 uppercase tracking-wider mb-0.5">{t("inbox.priorities.mediumPlural")}</div>
                      <div className="text-xl font-bold text-white">
                        {summaryLoading ? <Skeleton className="h-6 w-8 bg-white/5" /> : summary?.moyenCount || 0}
                      </div>
                    </div>
                    <div
                      className={`rounded-lg border p-3 cursor-pointer transition-colors ${filterPriority === "faible" ? "border-emerald-500/50 bg-emerald-500/15" : "border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10"}`}
                      onClick={() => setFilterPriority(filterPriority === "faible" ? "all" : "faible")}
                    >
                      <div className="text-[10px] font-medium text-emerald-400 uppercase tracking-wider mb-0.5">{t("inbox.priorities.lowPlural")}</div>
                      <div className="text-xl font-bold text-white">
                        {summaryLoading ? <Skeleton className="h-6 w-8 bg-white/5" /> : summary?.faibleCount || 0}
                      </div>
                    </div>
                  </div>

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
                        <span className="text-[11px] text-[#8b9cb3]">
                          {t("inbox.selectedCount", { count: selectedIds.size })}
                        </span>
                        <div className="flex-1" />
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 h-7 text-[11px] bg-transparent border-border text-[#8b9cb3] hover:text-white hover:bg-white/[0.04]"
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
                          className="h-7 px-2 text-[#8b9cb3] hover:text-white"
                          onClick={() => setSelectedIds(new Set())}
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </div>

                  <div className="space-y-1">
                    {emailsLoading ? (
                      Array(5).fill(0).map((_, i) => (
                        <div key={i} className="bg-card rounded-lg border border-border p-3">
                          <Skeleton className="h-4 w-3/4 mb-2 bg-white/5" />
                          <Skeleton className="h-3 w-1/2 bg-white/5" />
                        </div>
                      ))
                    ) : activeEmails?.length === 0 ? (
                      <div className="text-center py-14 rounded-lg border border-border border-dashed bg-card/50">
                        <Inbox className="mx-auto h-8 w-8 text-[#8b9cb3]/40 mb-2" />
                        <h3 className="text-[13px] font-medium text-white">{t("inbox.noEmails")}</h3>
                        <p className="text-[12px] text-[#8b9cb3] mt-1">{t("inbox.noEmailsDesc")}</p>
                      </div>
                    ) : (
                      <>
                        {activeEmails?.map((email) => {
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
                        })}
                        {hasMorePages && (
                          <div ref={loadMoreRef} className="py-2">
                            {emailsFetching ? (
                              <div className="space-y-2">
                                {[...Array(3)].map((_, i) => (
                                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card animate-pulse">
                                    <div className="w-1 h-10 rounded-full bg-white/5" />
                                    <div className="flex-1 space-y-2">
                                      <Skeleton className="h-3 w-32 bg-white/5" />
                                      <Skeleton className="h-3 w-48 bg-white/5" />
                                    </div>
                                    <Skeleton className="h-3 w-12 bg-white/5" />
                                  </div>
                                ))}
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
                            <span className="text-[10px] text-[#8b9cb3]/60">Tous les emails chargés ({totalEmails})</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="w-full lg:w-[200px] shrink-0 space-y-3">
              {hasHubspot && crmFilter === "hubspot" && (
                <HubspotContextPanel onHide={() => setCrmFilter(null)} />
              )}
              <div className="bg-card rounded-lg border border-border p-3">
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="text-[10px] font-medium text-[#8b9cb3] uppercase tracking-wider">
                    {t("inbox.category")}
                  </h3>
                  {(() => {
                    const JUNK = ["non classé", "non classe", "uncategorized"];
                    const summaryData = summary as { urgentCount?: number; moyenCount?: number; faibleCount?: number } | undefined;
                    const serverInboxTotal = (summaryData?.urgentCount || 0) + (summaryData?.moyenCount || 0) + (summaryData?.faibleCount || 0);
                    const categorizedTotal = (categoryCounts || []).reduce((sum, c) => sum + c.count, 0);
                    const junkTotal = (categoryCounts || []).filter((c) => JUNK.includes(c.categoryName.toLowerCase())).reduce((sum, c) => sum + c.count, 0);
                    const uncategorizedCount = Math.max(0, serverInboxTotal - categorizedTotal + junkTotal);
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
                  <div className="space-y-1.5">
                    <Skeleton className="h-5 w-full bg-white/5" />
                    <Skeleton className="h-5 w-full bg-white/5" />
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    <div
                      className={`flex items-center justify-between py-1 px-1.5 rounded transition-colors cursor-pointer ${filterCategory === "all" ? "bg-primary/10 text-primary" : "hover:bg-white/[0.04]"}`}
                      onClick={() => setFilterCategory("all")}
                    >
                      <span className="text-[11px]">{t("inbox.allCategories")}</span>
                      <span className="text-[10px] bg-white/[0.06] px-1.5 py-0.5 rounded">
                        {(() => {
                          const s = summary as { urgentCount?: number; moyenCount?: number; faibleCount?: number } | undefined;
                          return (s?.urgentCount || 0) + (s?.moyenCount || 0) + (s?.faibleCount || 0);
                        })()}
                      </span>
                    </div>
                    {categoryCounts?.map((cat) => (
                      <div
                        key={cat.categoryId}
                        className={`flex items-center justify-between py-1 px-1.5 rounded transition-colors cursor-pointer ${filterCategory === cat.categoryName ? "bg-primary/10 text-primary" : "hover:bg-white/[0.04]"}`}
                        onClick={() => setFilterCategory(filterCategory === cat.categoryName ? "all" : cat.categoryName)}
                      >
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                          <span className="text-[11px] text-[#8b9cb3]">{translateCategoryName(cat.categoryName, lang)}</span>
                        </div>
                        <span className="text-[10px] text-[#8b9cb3] bg-white/[0.06] px-1.5 py-0.5 rounded">
                          {cat.count}
                        </span>
                      </div>
                    ))}
                    {categoryCounts?.length === 0 && (
                      <p className="text-[11px] text-[#8b9cb3]/60 italic py-1.5">{t("inbox.noEmails")}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
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
              <span className="text-[10px] text-[#8b9cb3] uppercase tracking-wider font-medium">
                {t("inbox.selectedCount", { count: selectedIds.size })}
              </span>
            </div>
          )}
          <div className="py-1">
            {selectedIds.size <= 1 ? (
              <>
                <button
                  onClick={() => { setSelectedEmailId(contextMenu.emailId); setContextMenu(null); setSelectedIds(new Set()); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#8b9cb3] hover:bg-white/[0.06] hover:text-white transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                  {t("inbox.openEmail")}
                </button>
                <button
                  onClick={() => { handleArchive(contextMenu.emailId); setContextMenu(null); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#8b9cb3] hover:bg-white/[0.06] hover:text-white transition-colors"
                >
                  <Archive className="w-3.5 h-3.5" />
                  {t("inbox.archive")}
                </button>
                <button
                  onClick={() => { handleBlockSender(contextMenu.emailId); setContextMenu(null); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#8b9cb3] hover:bg-white/[0.06] hover:text-white transition-colors"
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
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#8b9cb3] hover:bg-white/[0.06] hover:text-white transition-colors"
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
